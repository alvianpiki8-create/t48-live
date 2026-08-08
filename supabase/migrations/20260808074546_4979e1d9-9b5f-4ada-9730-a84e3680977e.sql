ALTER TABLE public.replay_schedules DROP CONSTRAINT IF EXISTS replay_schedules_show_id_fkey;

ALTER TABLE public.access_tokens ADD COLUMN IF NOT EXISTS reset_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.access_tokens REPLICA IDENTITY FULL;
ALTER TABLE public.replay_schedules REPLICA IDENTITY FULL;
ALTER TABLE public.access_token_devices REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.access_tokens; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.replay_schedules; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.access_token_devices; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;