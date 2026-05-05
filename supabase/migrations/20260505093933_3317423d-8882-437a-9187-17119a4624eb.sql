ALTER TABLE public.stream_settings
  ADD COLUMN IF NOT EXISTS site_name text DEFAULT 'TEAM Live',
  ADD COLUMN IF NOT EXISTS allow_token_viewers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_weekly_members boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_monthly_members boolean NOT NULL DEFAULT true;