
-- Restore write access needed by Owner & Admin panels (app-level auth, uses anon key)

-- access_tokens: allow admin/owner to create, edit, delete
GRANT INSERT, UPDATE, DELETE ON public.access_tokens TO anon, authenticated;
DROP POLICY IF EXISTS "access_tokens_public_insert" ON public.access_tokens;
DROP POLICY IF EXISTS "access_tokens_public_update_all" ON public.access_tokens;
DROP POLICY IF EXISTS "access_tokens_public_delete" ON public.access_tokens;
CREATE POLICY "access_tokens_public_insert" ON public.access_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "access_tokens_public_update_all" ON public.access_tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "access_tokens_public_delete" ON public.access_tokens FOR DELETE TO anon, authenticated USING (true);

-- admin_link_logs: allow admin to log link creation & owner to clear
GRANT INSERT, DELETE ON public.admin_link_logs TO anon, authenticated;
DROP POLICY IF EXISTS "admin_link_logs_public_insert" ON public.admin_link_logs;
DROP POLICY IF EXISTS "admin_link_logs_public_delete" ON public.admin_link_logs;
CREATE POLICY "admin_link_logs_public_insert" ON public.admin_link_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin_link_logs_public_delete" ON public.admin_link_logs FOR DELETE TO anon, authenticated USING (true);

-- admins: owner manages admins from browser
GRANT INSERT, UPDATE, DELETE ON public.admins TO anon, authenticated;
DROP POLICY IF EXISTS "admins_public_insert" ON public.admins;
DROP POLICY IF EXISTS "admins_public_update" ON public.admins;
DROP POLICY IF EXISTS "admins_public_delete" ON public.admins;
CREATE POLICY "admins_public_insert" ON public.admins FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins_public_update" ON public.admins FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admins_public_delete" ON public.admins FOR DELETE TO anon, authenticated USING (true);

-- catalog_slides
GRANT INSERT, UPDATE, DELETE ON public.catalog_slides TO anon, authenticated;
DROP POLICY IF EXISTS "catalog_slides_public_insert" ON public.catalog_slides;
DROP POLICY IF EXISTS "catalog_slides_public_update" ON public.catalog_slides;
DROP POLICY IF EXISTS "catalog_slides_public_delete" ON public.catalog_slides;
CREATE POLICY "catalog_slides_public_insert" ON public.catalog_slides FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "catalog_slides_public_update" ON public.catalog_slides FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "catalog_slides_public_delete" ON public.catalog_slides FOR DELETE TO anon, authenticated USING (true);

-- chat_event_responses: owner delete
GRANT UPDATE, DELETE ON public.chat_event_responses TO anon, authenticated;
DROP POLICY IF EXISTS "chat_event_responses_public_update" ON public.chat_event_responses;
DROP POLICY IF EXISTS "chat_event_responses_public_delete" ON public.chat_event_responses;
CREATE POLICY "chat_event_responses_public_update" ON public.chat_event_responses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "chat_event_responses_public_delete" ON public.chat_event_responses FOR DELETE TO anon, authenticated USING (true);

-- moderators
GRANT INSERT, UPDATE, DELETE ON public.moderators TO anon, authenticated;
DROP POLICY IF EXISTS "moderators_public_insert" ON public.moderators;
DROP POLICY IF EXISTS "moderators_public_update" ON public.moderators;
DROP POLICY IF EXISTS "moderators_public_delete" ON public.moderators;
CREATE POLICY "moderators_public_insert" ON public.moderators FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "moderators_public_update" ON public.moderators FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "moderators_public_delete" ON public.moderators FOR DELETE TO anon, authenticated USING (true);

-- replay_schedules
GRANT INSERT, UPDATE, DELETE ON public.replay_schedules TO anon, authenticated;
DROP POLICY IF EXISTS "replay_schedules_public_insert" ON public.replay_schedules;
DROP POLICY IF EXISTS "replay_schedules_public_update" ON public.replay_schedules;
DROP POLICY IF EXISTS "replay_schedules_public_delete" ON public.replay_schedules;
CREATE POLICY "replay_schedules_public_insert" ON public.replay_schedules FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "replay_schedules_public_update" ON public.replay_schedules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "replay_schedules_public_delete" ON public.replay_schedules FOR DELETE TO anon, authenticated USING (true);

-- show_catalog
GRANT INSERT, UPDATE, DELETE ON public.show_catalog TO anon, authenticated;
DROP POLICY IF EXISTS "show_catalog_public_insert" ON public.show_catalog;
DROP POLICY IF EXISTS "show_catalog_public_update" ON public.show_catalog;
DROP POLICY IF EXISTS "show_catalog_public_delete" ON public.show_catalog;
CREATE POLICY "show_catalog_public_insert" ON public.show_catalog FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "show_catalog_public_update" ON public.show_catalog FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "show_catalog_public_delete" ON public.show_catalog FOR DELETE TO anon, authenticated USING (true);

-- shows (lineup)
GRANT INSERT, UPDATE, DELETE ON public.shows TO anon, authenticated;
DROP POLICY IF EXISTS "shows_public_insert" ON public.shows;
DROP POLICY IF EXISTS "shows_public_update" ON public.shows;
DROP POLICY IF EXISTS "shows_public_delete" ON public.shows;
CREATE POLICY "shows_public_insert" ON public.shows FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "shows_public_update" ON public.shows FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shows_public_delete" ON public.shows FOR DELETE TO anon, authenticated USING (true);

-- stream_settings: add DELETE (INSERT & UPDATE already present)
GRANT DELETE ON public.stream_settings TO anon, authenticated;
DROP POLICY IF EXISTS "stream_settings_owner_delete" ON public.stream_settings;
CREATE POLICY "stream_settings_owner_delete" ON public.stream_settings FOR DELETE TO anon, authenticated USING (true);
