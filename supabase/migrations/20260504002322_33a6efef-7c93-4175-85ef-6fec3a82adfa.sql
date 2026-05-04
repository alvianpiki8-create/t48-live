
-- 1) Harden handle_new_user(): no email-based privilege escalation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nickname, user_code, coins)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'),
    public.generate_user_code(),
    0
  );
  RETURN NEW;
END;
$function$;

-- 2) Tighten catalog-images bucket: writes require an authenticated session
DROP POLICY IF EXISTS "Anyone can upload catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete catalog images" ON storage.objects;

CREATE POLICY "Authenticated can upload catalog images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-images');

CREATE POLICY "Authenticated can update catalog images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-images')
  WITH CHECK (bucket_id = 'catalog-images');

CREATE POLICY "Authenticated can delete catalog images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-images');
