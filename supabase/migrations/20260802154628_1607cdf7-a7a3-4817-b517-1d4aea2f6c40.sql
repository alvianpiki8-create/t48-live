ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS show_date date,
  ADD COLUMN IF NOT EXISTS access_hour text,
  ADD COLUMN IF NOT EXISTS access_duration_hours integer NOT NULL DEFAULT 24;