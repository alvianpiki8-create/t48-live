GRANT DELETE ON public.chat_messages TO anon, authenticated;
CREATE POLICY "chat_messages_public_delete" ON public.chat_messages FOR DELETE TO anon, authenticated USING (true);

GRANT DELETE ON public.chat_reports TO anon, authenticated;
DROP POLICY IF EXISTS "chat_reports_public_update" ON public.chat_reports;
DROP POLICY IF EXISTS "chat_reports_public_delete" ON public.chat_reports;
CREATE POLICY "chat_reports_public_update" ON public.chat_reports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "chat_reports_public_delete" ON public.chat_reports FOR DELETE TO anon, authenticated USING (true);