CREATE TABLE IF NOT EXISTS public.catalog_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_slides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catalog_slides'
      AND policyname = 'Anyone can view catalog slides'
  ) THEN
    CREATE POLICY "Anyone can view catalog slides"
    ON public.catalog_slides
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catalog_slides'
      AND policyname = 'Anyone can manage catalog slides'
  ) THEN
    CREATE POLICY "Anyone can manage catalog slides"
    ON public.catalog_slides
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_catalog_slides_active_order
ON public.catalog_slides (is_active, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_catalog_slides_updated_at ON public.catalog_slides;
CREATE TRIGGER update_catalog_slides_updated_at
BEFORE UPDATE ON public.catalog_slides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();