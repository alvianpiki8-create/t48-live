ALTER TABLE public.stream_settings ADD COLUMN IF NOT EXISTS stream_source_url_2 TEXT;

ALTER TABLE public.stream_settings REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;