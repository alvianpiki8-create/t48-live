GRANT INSERT, UPDATE ON public.stream_settings TO anon, authenticated;

DROP POLICY IF EXISTS "stream_settings_owner_insert" ON public.stream_settings;
DROP POLICY IF EXISTS "stream_settings_owner_update" ON public.stream_settings;

CREATE POLICY "stream_settings_owner_insert" ON public.stream_settings
FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "stream_settings_owner_update" ON public.stream_settings
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);