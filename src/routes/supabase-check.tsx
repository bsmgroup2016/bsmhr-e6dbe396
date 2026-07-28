import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/app-shell';

export const Route = createFileRoute('/supabase-check')({
  component: SupabaseCheck,
  head: () => ({
    meta: [
      { title: 'Supabase Diagnostic | BSM Workforce' },
      { name: 'description', content: 'Temporary diagnostic page verifying the self-hosted Supabase connection, auth endpoint and session status.' },
      { property: 'og:title', content: 'Supabase Diagnostic | BSM Workforce' },
      { property: 'og:description', content: 'Temporary diagnostic page verifying the self-hosted Supabase connection.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
});

type Check = { label: string; state: 'pending' | 'ok' | 'fail'; detail: string };

function SupabaseCheck() {
  const [checks, setChecks] = useState<Check[]>([
    { label: 'Supabase reachable', state: 'pending', detail: '' },
    { label: 'Auth reachable', state: 'pending', detail: '' },
    { label: 'Session status', state: 'pending', detail: '' },
    { label: 'Database (REST) reachable', state: 'pending', detail: '' },
  ]);

  const url = 'https://supabase.vrlle.com';

  useEffect(() => {
    (async () => {
      const next: Check[] = [];

      try {
        const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: (supabase as unknown as { supabaseKey: string }).supabaseKey } });
        next.push({ label: 'Supabase reachable', state: res.ok ? 'ok' : 'fail', detail: `HTTP ${res.status} at ${url}` });
      } catch (e) {
        next.push({ label: 'Supabase reachable', state: 'fail', detail: String(e) });
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          next.push({ label: 'Auth reachable', state: 'fail', detail: error.message });
          next.push({ label: 'Session status', state: 'fail', detail: error.message });
        } else {
          next.push({ label: 'Auth reachable', state: 'ok', detail: 'auth.getSession() succeeded' });
          next.push({
            label: 'Session status',
            state: 'ok',
            detail: data.session ? `Signed in as ${data.session.user.email ?? data.session.user.id}` : 'No active session (signed out)',
          });
        }
      } catch (e) {
        next.push({ label: 'Auth reachable', state: 'fail', detail: String(e) });
        next.push({ label: 'Session status', state: 'fail', detail: String(e) });
      }

      try {
        const { error } = await supabase.from('profiles' as never).select('*').limit(1);
        next.push({
          label: 'Database (REST) reachable',
          state: error ? 'fail' : 'ok',
          detail: error ? error.message : 'PostgREST query succeeded',
        });
      } catch (e) {
        next.push({ label: 'Database (REST) reachable', state: 'fail', detail: String(e) });
      }

      setChecks(next);
    })();
  }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Supabase Diagnostic</h1>
          <p className="text-muted-foreground text-sm">Temporary page — connection check for {url}</p>
        </div>
        <div className="space-y-3">
          {checks.map((c) => (
            <div key={c.label} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{c.label}</span>
                <span
                  className={
                    c.state === 'ok'
                      ? 'text-sm font-semibold text-emerald-600'
                      : c.state === 'fail'
                        ? 'text-sm font-semibold text-destructive'
                        : 'text-sm text-muted-foreground'
                  }
                >
                  {c.state === 'ok' ? 'OK' : c.state === 'fail' ? 'FAILED' : 'Checking…'}
                </span>
              </div>
              {c.detail && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{c.detail}</p>}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
