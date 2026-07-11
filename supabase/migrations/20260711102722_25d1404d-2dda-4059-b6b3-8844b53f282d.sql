
-- =========================================================
-- access_tokens: constrain writes; keep public SELECT + limited device-binding UPDATE
-- =========================================================
DROP POLICY IF EXISTS "Anyone can create tokens" ON public.access_tokens;
DROP POLICY IF EXISTS "Anyone can delete tokens" ON public.access_tokens;
DROP POLICY IF EXISTS "Anyone can bind device to token" ON public.access_tokens;

-- Only allow device binding on a still-unbound token; forbids hijacking existing bindings
CREATE POLICY "Public can bind device only when unbound"
  ON public.access_tokens
  FOR UPDATE
  TO anon, authenticated
  USING (device_id IS NULL)
  WITH CHECK (true);

REVOKE INSERT, DELETE ON public.access_tokens FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.access_tokens TO anon, authenticated;
GRANT ALL ON public.access_tokens TO service_role;

-- =========================================================
-- admin_link_logs: public read stays; writes restricted to service_role
-- =========================================================
DROP POLICY IF EXISTS "Anyone can insert admin link logs" ON public.admin_link_logs;
DROP POLICY IF EXISTS "Anyone can delete admin link logs" ON public.admin_link_logs;

REVOKE INSERT, UPDATE, DELETE ON public.admin_link_logs FROM anon, authenticated;
GRANT SELECT ON public.admin_link_logs TO anon, authenticated;
GRANT ALL ON public.admin_link_logs TO service_role;

-- =========================================================
-- admins: keep public SELECT (login lookup); block public writes
-- =========================================================
DROP POLICY IF EXISTS "Anyone can insert admins" ON public.admins;
DROP POLICY IF EXISTS "Anyone can update admins" ON public.admins;
DROP POLICY IF EXISTS "Anyone can delete admins" ON public.admins;

REVOKE INSERT, UPDATE, DELETE ON public.admins FROM anon, authenticated;
GRANT SELECT ON public.admins TO anon, authenticated;
GRANT ALL ON public.admins TO service_role;

-- =========================================================
-- moderators: keep public SELECT; block public writes
-- =========================================================
DROP POLICY IF EXISTS "Anyone can insert moderators" ON public.moderators;
DROP POLICY IF EXISTS "Anyone can delete moderators" ON public.moderators;

REVOKE INSERT, UPDATE, DELETE ON public.moderators FROM anon, authenticated;
GRANT SELECT ON public.moderators TO anon, authenticated;
GRANT ALL ON public.moderators TO service_role;

-- =========================================================
-- catalog_slides: public read; writes restricted
-- =========================================================
DROP POLICY IF EXISTS "Anyone can manage catalog slides" ON public.catalog_slides;

REVOKE INSERT, UPDATE, DELETE ON public.catalog_slides FROM anon, authenticated;
GRANT SELECT ON public.catalog_slides TO anon, authenticated;
GRANT ALL ON public.catalog_slides TO service_role;

-- =========================================================
-- replay_schedules: public read (leave in place); writes restricted
-- =========================================================
DROP POLICY IF EXISTS "Anyone can manage replay schedules" ON public.replay_schedules;

REVOKE INSERT, UPDATE, DELETE ON public.replay_schedules FROM anon, authenticated;
GRANT SELECT ON public.replay_schedules TO anon, authenticated;
GRANT ALL ON public.replay_schedules TO service_role;

-- =========================================================
-- show_catalog: public read; writes restricted
-- =========================================================
DROP POLICY IF EXISTS "Anyone can manage shows" ON public.show_catalog;

REVOKE INSERT, UPDATE, DELETE ON public.show_catalog FROM anon, authenticated;
GRANT SELECT ON public.show_catalog TO anon, authenticated;
GRANT ALL ON public.show_catalog TO service_role;

-- =========================================================
-- shows: public read; writes restricted
-- =========================================================
DROP POLICY IF EXISTS "Anyone can insert shows" ON public.shows;
DROP POLICY IF EXISTS "Anyone can update shows" ON public.shows;
DROP POLICY IF EXISTS "Anyone can delete shows" ON public.shows;

REVOKE INSERT, UPDATE, DELETE ON public.shows FROM anon, authenticated;
GRANT SELECT ON public.shows TO anon, authenticated;
GRANT ALL ON public.shows TO service_role;

-- =========================================================
-- stream_settings: public read; writes restricted
-- =========================================================
DROP POLICY IF EXISTS "Anyone can insert stream_settings" ON public.stream_settings;
DROP POLICY IF EXISTS "Anyone can update stream_settings" ON public.stream_settings;

REVOKE INSERT, UPDATE, DELETE ON public.stream_settings FROM anon, authenticated;
GRANT SELECT ON public.stream_settings TO anon, authenticated;
GRANT ALL ON public.stream_settings TO service_role;

-- =========================================================
-- chat_event_responses: keep public INSERT + SELECT; block public DELETE
-- =========================================================
DROP POLICY IF EXISTS "Anyone can delete responses" ON public.chat_event_responses;

REVOKE DELETE, UPDATE ON public.chat_event_responses FROM anon, authenticated;
GRANT SELECT, INSERT ON public.chat_event_responses TO anon, authenticated;
GRANT ALL ON public.chat_event_responses TO service_role;

-- =========================================================
-- chat_messages: keep public INSERT + SELECT; block public DELETE
-- =========================================================
DROP POLICY IF EXISTS "Anyone can delete chat" ON public.chat_messages;

REVOKE DELETE ON public.chat_messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- =========================================================
-- coin_topup_requests: users create + read own; only service_role can update status
-- =========================================================
DROP POLICY IF EXISTS "Anyone can update topup requests" ON public.coin_topup_requests;

REVOKE UPDATE, DELETE ON public.coin_topup_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON public.coin_topup_requests TO authenticated;
GRANT ALL ON public.coin_topup_requests TO service_role;
