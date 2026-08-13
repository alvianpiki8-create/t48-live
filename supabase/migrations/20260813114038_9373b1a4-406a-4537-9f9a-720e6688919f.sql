ALTER TABLE public.show_catalog ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS show_catalog_external_id_key ON public.show_catalog (external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shows_show_code_key ON public.shows (show_code) WHERE show_code IS NOT NULL;