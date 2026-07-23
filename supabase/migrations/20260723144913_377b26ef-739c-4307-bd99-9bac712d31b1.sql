
-- Auto-delete expired access tokens hourly.
CREATE OR REPLACE FUNCTION public.cleanup_expired_access_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.access_tokens
  WHERE (valid_until IS NOT NULL AND valid_until < now())
     OR (valid_until IS NULL AND expires_at IS NOT NULL AND expires_at < CURRENT_DATE);
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('cleanup-expired-access-tokens');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

SELECT cron.schedule(
  'cleanup-expired-access-tokens',
  '15 * * * *',
  $$ SELECT public.cleanup_expired_access_tokens(); $$
);
