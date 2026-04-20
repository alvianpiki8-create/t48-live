
ALTER TABLE public.stream_settings 
ADD COLUMN IF NOT EXISTS video_id text DEFAULT '',
ADD COLUMN IF NOT EXISTS idn_live_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS channel_name text DEFAULT 'TEAM Live',
ADD COLUMN IF NOT EXISTS stream_title text DEFAULT 'Siaran Langsung',
ADD COLUMN IF NOT EXISTS channel_avatar text DEFAULT '',
ADD COLUMN IF NOT EXISTS membership_link text DEFAULT '',
ADD COLUMN IF NOT EXISTS access_days integer DEFAULT 7;
