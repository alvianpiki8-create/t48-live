CREATE OR REPLACE FUNCTION public.cleanup_expired_access_tokens()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Hanya hapus token yang benar-benar habis masa berlakunya.
  -- valid_until diisi saat token pertama kali dipakai.
  DELETE FROM public.access_tokens
  WHERE (valid_until IS NOT NULL AND valid_until < now())
     OR (
       valid_until IS NULL
       AND created_at < now() - interval '90 days'
     );
END;
$function$;