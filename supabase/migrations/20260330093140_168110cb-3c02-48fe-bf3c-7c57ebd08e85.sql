
-- Shows table
CREATE TABLE public.shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shows" ON public.shows FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert shows" ON public.shows FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update shows" ON public.shows FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete shows" ON public.shows FOR DELETE TO public USING (true);

-- Insert default shows
INSERT INTO public.shows (name) VALUES
  ('Cara meminum ramune'),
  ('Pertaruhan cinta'),
  ('Sambil menggandeng erat tangan ku'),
  ('Pajama drive');

-- Stream settings table (single row)
CREATE TABLE public.stream_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  countdown_datetime TIMESTAMP WITH TIME ZONE,
  backup_video_url TEXT DEFAULT '',
  replay_url TEXT DEFAULT 't48.lovable.app/replay',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stream_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stream_settings" ON public.stream_settings FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert stream_settings" ON public.stream_settings FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update stream_settings" ON public.stream_settings FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Insert default row
INSERT INTO public.stream_settings (backup_video_url, replay_url) VALUES ('', 't48.lovable.app/replay');

-- Add columns to access_tokens
ALTER TABLE public.access_tokens ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE public.access_tokens ADD COLUMN IF NOT EXISTS show_name TEXT;
ALTER TABLE public.access_tokens ADD COLUMN IF NOT EXISTS access_hour TEXT;
