CREATE TABLE IF NOT EXISTS public.chat_banned_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL UNIQUE,
  reason text,
  banned_word text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_banned_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat bans" ON public.chat_banned_devices FOR SELECT USING (true);
CREATE POLICY "Anyone can insert chat bans" ON public.chat_banned_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete chat bans" ON public.chat_banned_devices FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_banned_device_id ON public.chat_banned_devices(device_id);