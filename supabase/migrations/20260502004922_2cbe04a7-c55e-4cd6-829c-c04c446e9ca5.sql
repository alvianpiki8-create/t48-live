-- 1. Chat reports table
CREATE TABLE IF NOT EXISTS public.chat_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  message_nickname TEXT NOT NULL,
  message_device_id TEXT,
  reporter_nickname TEXT NOT NULL,
  reporter_device_id TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reports"
  ON public.chat_reports FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can read reports"
  ON public.chat_reports FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can update reports"
  ON public.chat_reports FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete reports"
  ON public.chat_reports FOR DELETE TO public USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_reports_status ON public.chat_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reports_message ON public.chat_reports(message_id);

-- 2. Realtime
ALTER TABLE public.chat_reports REPLICA IDENTITY FULL;
ALTER TABLE public.admin_link_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_link_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 3. pg_cron + pg_net for scheduled reset
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.reset_admin_link_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_link_logs;
END;
$$;

-- Schedule: every 3 days at 00:00
DO $$
BEGIN
  PERFORM cron.unschedule('reset-admin-link-logs-3d');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reset-admin-link-logs-3d',
  '0 0 */3 * *',
  $$ SELECT public.reset_admin_link_logs(); $$
);