ALTER TABLE public.show_catalog ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE public.stream_settings ADD COLUMN IF NOT EXISTS catalog_background_url TEXT DEFAULT '';
ALTER TABLE public.stream_settings ADD COLUMN IF NOT EXISTS catalog_background_type TEXT DEFAULT 'image';