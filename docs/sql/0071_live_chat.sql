-- Live chat: staff talk to the AI assistant; admin/HR/manager can take over.
-- Service-role-only: all access goes through /api/public/live-chat.
CREATE TABLE IF NOT EXISTS public.live_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  status text NOT NULL DEFAULT 'ai' CHECK (status IN ('ai','human','closed')),
  agent_id uuid,
  unread_agent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.live_chats(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user','ai','agent','system')),
  author_id uuid,
  author_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_chats_user_idx ON public.live_chats(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS live_chats_updated_idx ON public.live_chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS live_chat_messages_chat_idx ON public.live_chat_messages(chat_id, created_at);

GRANT ALL ON public.live_chats TO service_role;
GRANT ALL ON public.live_chat_messages TO service_role;
REVOKE ALL ON public.live_chats FROM anon, authenticated;
REVOKE ALL ON public.live_chat_messages FROM anon, authenticated;
ALTER TABLE public.live_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
