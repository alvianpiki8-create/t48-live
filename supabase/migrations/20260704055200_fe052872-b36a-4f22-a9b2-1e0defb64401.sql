ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS payment_reset_at timestamptz;
ALTER TABLE public.stream_settings ADD COLUMN IF NOT EXISTS replay_youtube_url text DEFAULT '';