ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS show_code text;
CREATE UNIQUE INDEX IF NOT EXISTS shows_show_code_key ON public.shows (lower(show_code)) WHERE show_code IS NOT NULL;
ALTER TABLE public.replay_schedules ADD COLUMN IF NOT EXISTS show_id uuid REFERENCES public.shows(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS replay_schedules_show_id_idx ON public.replay_schedules (show_id);