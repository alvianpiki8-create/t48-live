
CREATE TABLE public.chat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('poll','quiz')),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  is_active boolean NOT NULL DEFAULT true,
  reveal_answer boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz
);

CREATE TABLE public.chat_event_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.chat_events(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  nickname text,
  answer text NOT NULL,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, device_id)
);

CREATE INDEX idx_chat_event_responses_event ON public.chat_event_responses(event_id);
CREATE INDEX idx_chat_events_active ON public.chat_events(is_active, created_at DESC);

ALTER TABLE public.chat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_event_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat events" ON public.chat_events FOR SELECT USING (true);
CREATE POLICY "Anyone can insert chat events" ON public.chat_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chat events" ON public.chat_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete chat events" ON public.chat_events FOR DELETE USING (true);

CREATE POLICY "Anyone can read responses" ON public.chat_event_responses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert responses" ON public.chat_event_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete responses" ON public.chat_event_responses FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_event_responses;
ALTER TABLE public.chat_events REPLICA IDENTITY FULL;
ALTER TABLE public.chat_event_responses REPLICA IDENTITY FULL;
