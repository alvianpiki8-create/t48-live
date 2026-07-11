GRANT UPDATE ON public.chat_messages TO anon, authenticated;
CREATE POLICY "chat_messages_public_update" ON public.chat_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);