
ALTER TABLE public.stream_settings
  ADD COLUMN IF NOT EXISTS qris_image_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_reminder_text TEXT;

DO $$
BEGIN
  PERFORM cron.unschedule('reset-admin-link-logs-3d');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('reset-admin-link-logs-5d');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reset-admin-link-logs-5d',
  '0 0 */5 * *',
  $$ SELECT public.reset_admin_link_logs(); $$
);
