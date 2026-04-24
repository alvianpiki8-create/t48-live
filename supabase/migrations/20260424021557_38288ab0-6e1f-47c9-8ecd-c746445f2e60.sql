
ALTER TABLE public.stream_settings ADD COLUMN IF NOT EXISTS is_singleton boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS stream_settings_singleton_idx ON public.stream_settings (is_singleton);
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_settings;
ALTER TABLE public.stream_settings REPLICA IDENTITY FULL;
