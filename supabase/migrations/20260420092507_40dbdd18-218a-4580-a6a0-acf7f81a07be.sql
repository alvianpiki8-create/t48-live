CREATE TABLE IF NOT EXISTS public.viewer_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  visited_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viewer_visits_visited_at ON public.viewer_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_viewer_visits_device_day ON public.viewer_visits(device_id, visited_at);

ALTER TABLE public.viewer_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log visits" ON public.viewer_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read visits" ON public.viewer_visits FOR SELECT USING (true);