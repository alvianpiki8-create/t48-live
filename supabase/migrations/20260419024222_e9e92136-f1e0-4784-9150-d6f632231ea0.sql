-- access_tokens: durasi hari + tanggal valid
ALTER TABLE public.access_tokens
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz;

-- stream_settings: dukungan m3u8 + logo
ALTER TABLE public.stream_settings
  ADD COLUMN IF NOT EXISTS stream_source_type text DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS stream_source_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';

-- show_catalog: jam akses
ALTER TABLE public.show_catalog
  ADD COLUMN IF NOT EXISTS access_hour text;

-- chat_messages: izinkan delete oleh siapa saja (kontrol di app via moderator list)
DROP POLICY IF EXISTS "Anyone can delete chat" ON public.chat_messages;
CREATE POLICY "Anyone can delete chat"
  ON public.chat_messages FOR DELETE
  USING (true);

-- moderators table
CREATE TABLE IF NOT EXISTS public.moderators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL UNIQUE,
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read moderators"
  ON public.moderators FOR SELECT USING (true);
CREATE POLICY "Anyone can insert moderators"
  ON public.moderators FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete moderators"
  ON public.moderators FOR DELETE USING (true);

-- Storage bucket untuk gambar katalog
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Catalog images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-images');

CREATE POLICY "Anyone can upload catalog images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'catalog-images');

CREATE POLICY "Anyone can update catalog images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'catalog-images');

CREATE POLICY "Anyone can delete catalog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-images');