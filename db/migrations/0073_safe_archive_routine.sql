-- Fixed allowlist. No tables, policies, existing data or existing grants changed.
CREATE OR REPLACE FUNCTION public.safe_archive_batch(
  p_action text, p_table text, p_cutoff timestamptz,
  p_holds jsonb DEFAULT '[]'::jsonb, p_expected jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  rel text; pred text; ident text; ordering text; rows_data jsonb; messages_data jsonb := '[]'::jsonb;
  expected_row jsonb; actual_row jsonb; message_row jsonb; v_chat_id uuid; deleted_count integer := 0;
  changed_count integer := 0; n integer; eligible_count bigint; logical_bytes bigint; message_count bigint; message_bytes bigint;
BEGIN
  IF p_action NOT IN ('count','preview','commit','reconcile') THEN RAISE EXCEPTION 'Invalid archive action'; END IF;
  IF p_cutoff IS NULL OR p_cutoff > now() THEN RAISE EXCEPTION 'Invalid cutoff'; END IF;
  IF jsonb_typeof(p_holds) <> 'array' OR jsonb_array_length(p_holds)>2000 THEN RAISE EXCEPTION 'Invalid holds'; END IF;
  CASE p_table
    WHEN 'cron.job_run_details' THEN rel := 'cron.job_run_details'; pred := 'end_time IS NOT NULL AND end_time < $1'; ident := 'runid::text'; ordering := 'end_time,runid';
    WHEN 'api_rate_limits' THEN rel := 'public.api_rate_limits'; pred := 'window_start < $1 AND window_start < now()-interval ''2 hours'''; ident := '(bucket||''|''||window_start::text)'; ordering := 'window_start,bucket';
    WHEN 'ai_crawl_runs' THEN rel := 'public.ai_crawl_runs'; pred := 'finished_at IS NOT NULL AND finished_at < $1 AND status IN (''done'',''error'',''failed'') AND id IS DISTINCT FROM (SELECT id FROM public.ai_crawl_runs WHERE status=''done'' ORDER BY finished_at DESC NULLS LAST,id DESC LIMIT 1)'; ident := 'id::text'; ordering := 'finished_at,id';
    WHEN 'driver_task_pings' THEN rel := 'public.driver_task_pings'; pred := 'recorded_at < $1'; ident := 'id::text'; ordering := 'recorded_at,id';
    WHEN 'audit_logs' THEN rel := 'public.audit_logs'; pred := 'created_at < $1'; ident := 'id::text'; ordering := 'created_at,id';
    WHEN 'live_chats' THEN rel := 'public.live_chats'; pred := 'status=''closed'' AND created_at < $1 AND updated_at < $1 AND NOT EXISTS (SELECT 1 FROM public.live_chat_messages m WHERE m.chat_id=t.id AND m.created_at >= $1)'; ident := 'id::text'; ordering := 'updated_at,id';
    ELSE RAISE EXCEPTION 'Protected table';
  END CASE;
  pred := pred || format(' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text($2) h WHERE h=%s)',ident);
  IF p_action='count' THEN
    EXECUTE format('SELECT count(*),coalesce(sum(pg_column_size(t)),0) FROM %s t WHERE %s',rel,pred) INTO eligible_count,logical_bytes USING p_cutoff,p_holds;
    IF p_table='live_chats' THEN
      EXECUTE format('SELECT count(*),coalesce(sum(pg_column_size(m)),0) FROM public.live_chat_messages m WHERE m.chat_id IN (SELECT t.id FROM %s t WHERE %s)',rel,pred) INTO message_count,message_bytes USING p_cutoff,p_holds;
      RETURN jsonb_build_object('rows',eligible_count,'bytes',logical_bytes+message_bytes,'messages',message_count);
    END IF;
    RETURN jsonb_build_object('rows',eligible_count,'bytes',logical_bytes,'messages',0);
  END IF;
  IF p_action='preview' THEN
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) FROM (SELECT t.* FROM %s t WHERE %s ORDER BY %s LIMIT %s) q',rel,pred,ordering,CASE WHEN p_table='live_chats' THEN 1 ELSE 250 END) INTO rows_data USING p_cutoff,p_holds;
    IF p_table='live_chats' AND jsonb_array_length(rows_data)>0 THEN
      v_chat_id := (rows_data->0->>'id')::uuid;
      SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO messages_data FROM (SELECT m.* FROM public.live_chat_messages m WHERE m.chat_id=v_chat_id ORDER BY created_at,id LIMIT 249) q;
    END IF;
    RETURN jsonb_build_object('rows',rows_data,'messages',messages_data);
  END IF;
  IF jsonb_typeof(p_expected->'rows')<>'array' OR jsonb_typeof(p_expected->'messages')<>'array'
    OR coalesce(jsonb_array_length(p_expected->'rows'),0)+coalesce(jsonb_array_length(p_expected->'messages'),0)>250
    OR octet_length(p_expected::text)>2000000 THEN RAISE EXCEPTION 'Invalid or oversized batch'; END IF;
  -- All row checks/deletions are atomic. Parent locks block FK inserts during chat cleanup.
  PERFORM pg_advisory_xact_lock(73730001);
  IF p_action='reconcile' THEN
    -- Pure status read under the same lock; never retries or deletes uncertain work.
    FOR expected_row IN SELECT value FROM jsonb_array_elements(p_expected->'rows') LOOP
      IF p_table='api_rate_limits' THEN
        SELECT to_jsonb(t) INTO actual_row FROM public.api_rate_limits t WHERE bucket=expected_row->>'bucket' AND window_start=(expected_row->>'window_start')::timestamptz;
      ELSIF p_table='cron.job_run_details' THEN
        SELECT to_jsonb(t) INTO actual_row FROM cron.job_run_details t WHERE runid=(expected_row->>'runid')::bigint;
      ELSE
        EXECUTE format('SELECT to_jsonb(t) FROM %s t WHERE id=$1',rel) INTO actual_row USING (expected_row->>'id')::uuid;
      END IF;
      IF actual_row IS NULL THEN deleted_count:=deleted_count+1; ELSE changed_count:=changed_count+1; END IF;
    END LOOP;
    FOR message_row IN SELECT value FROM jsonb_array_elements(p_expected->'messages') LOOP
      IF NOT EXISTS(SELECT 1 FROM public.live_chat_messages WHERE id=(message_row->>'id')::uuid) THEN deleted_count:=deleted_count+1; ELSE changed_count:=changed_count+1; END IF;
    END LOOP;
    RETURN jsonb_build_object('missing',deleted_count,'remaining',changed_count);
  END IF;
  FOR expected_row IN SELECT value FROM jsonb_array_elements(p_expected->'rows') LOOP
    actual_row := NULL;
    IF p_table='api_rate_limits' THEN
      EXECUTE format('SELECT to_jsonb(t) FROM %s t WHERE bucket=$3 AND window_start=$4 AND %s FOR UPDATE',rel,pred) INTO actual_row USING p_cutoff,p_holds,expected_row->>'bucket',(expected_row->>'window_start')::timestamptz;
    ELSIF p_table='cron.job_run_details' THEN
      EXECUTE format('SELECT to_jsonb(t) FROM %s t WHERE runid=$3 AND %s FOR UPDATE',rel,pred) INTO actual_row USING p_cutoff,p_holds,(expected_row->>'runid')::bigint;
    ELSE
      EXECUTE format('SELECT to_jsonb(t) FROM %s t WHERE id=$3 AND %s FOR UPDATE',rel,pred) INTO actual_row USING p_cutoff,p_holds,(expected_row->>'id')::uuid;
    END IF;
    IF actual_row IS NULL OR actual_row<>expected_row THEN changed_count:=changed_count+1; CONTINUE; END IF;
    IF p_table='live_chats' THEN
      v_chat_id:=(expected_row->>'id')::uuid;
      FOR message_row IN SELECT value FROM jsonb_array_elements(p_expected->'messages') LOOP
        IF (message_row->>'chat_id')::uuid<>v_chat_id THEN RAISE EXCEPTION 'Invalid message parent'; END IF;
        SELECT to_jsonb(m) INTO actual_row FROM public.live_chat_messages m WHERE id=(message_row->>'id')::uuid AND m.chat_id=v_chat_id AND created_at<p_cutoff FOR UPDATE;
        IF actual_row=message_row THEN
          DELETE FROM public.live_chat_messages WHERE id=(message_row->>'id')::uuid;
          GET DIAGNOSTICS n=ROW_COUNT; deleted_count:=deleted_count+n;
        ELSE changed_count:=changed_count+1; END IF;
      END LOOP;
      IF NOT EXISTS(SELECT 1 FROM public.live_chat_messages m WHERE m.chat_id=v_chat_id) THEN
        DELETE FROM public.live_chats WHERE id=v_chat_id;
        GET DIAGNOSTICS n=ROW_COUNT; deleted_count:=deleted_count+n;
      END IF;
    ELSIF p_table='api_rate_limits' THEN
      DELETE FROM public.api_rate_limits WHERE bucket=expected_row->>'bucket' AND window_start=(expected_row->>'window_start')::timestamptz;
      GET DIAGNOSTICS n=ROW_COUNT; deleted_count:=deleted_count+n;
    ELSIF p_table='cron.job_run_details' THEN
      DELETE FROM cron.job_run_details WHERE runid=(expected_row->>'runid')::bigint;
      GET DIAGNOSTICS n=ROW_COUNT; deleted_count:=deleted_count+n;
    ELSE
      EXECUTE format('DELETE FROM %s WHERE id=$1',rel) USING (expected_row->>'id')::uuid;
      GET DIAGNOSTICS n=ROW_COUNT; deleted_count:=deleted_count+n;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('deleted',deleted_count,'changed',changed_count);
END $$;
REVOKE ALL ON FUNCTION public.safe_archive_batch(text,text,timestamptz,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.safe_archive_batch(text,text,timestamptz,jsonb,jsonb) TO service_role;