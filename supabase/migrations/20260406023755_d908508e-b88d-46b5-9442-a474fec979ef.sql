
-- Add replay_password to stream_settings
ALTER TABLE public.stream_settings ADD COLUMN IF NOT EXISTS replay_password text DEFAULT '';

-- Create chat_messages table for realtime comments
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname text NOT NULL,
  text text NOT NULL,
  color text NOT NULL DEFAULT 'hsl(0, 0%, 100%)',
  device_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat" ON public.chat_messages FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can send chat" ON public.chat_messages FOR INSERT TO public WITH CHECK (true);

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
