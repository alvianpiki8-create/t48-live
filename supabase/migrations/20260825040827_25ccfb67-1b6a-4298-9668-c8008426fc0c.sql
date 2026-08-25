REVOKE EXECUTE ON FUNCTION public.cleanup_expired_access_tokens() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_access_tokens() TO service_role;