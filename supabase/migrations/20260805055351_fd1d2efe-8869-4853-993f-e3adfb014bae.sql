-- 1) Server-side quiz correctness
CREATE OR REPLACE FUNCTION public.set_chat_response_correctness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ev record;
BEGIN
  SELECT type, correct_answer INTO ev FROM public.chat_events WHERE id = NEW.event_id;
  IF ev.type = 'quiz' AND ev.correct_answer IS NOT NULL THEN
    NEW.is_correct := (NEW.answer = ev.correct_answer);
  ELSE
    NEW.is_correct := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_response_correctness ON public.chat_event_responses;
CREATE TRIGGER trg_chat_response_correctness
BEFORE INSERT OR UPDATE ON public.chat_event_responses
FOR EACH ROW EXECUTE FUNCTION public.set_chat_response_correctness();

-- 2) Hide chat_events.correct_answer from public reads
REVOKE SELECT ON public.chat_events FROM anon, authenticated;
GRANT SELECT (id, type, question, options, is_active, reveal_answer, created_by, created_at, ends_at)
  ON public.chat_events TO anon, authenticated;
GRANT ALL ON public.chat_events TO service_role;

CREATE OR REPLACE FUNCTION public.get_chat_events_public(p_limit integer DEFAULT 5)
RETURNS TABLE (
  id uuid, type text, question text, options jsonb,
  correct_answer text, is_active boolean, reveal_answer boolean,
  created_at timestamptz, ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.type, e.question, e.options,
         CASE WHEN e.reveal_answer OR NOT e.is_active THEN e.correct_answer ELSE NULL END,
         e.is_active, e.reveal_answer, e.created_at, e.ends_at
  FROM public.chat_events e
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20));
$$;
GRANT EXECUTE ON FUNCTION public.get_chat_events_public(integer) TO anon, authenticated;

-- 3) Hide replay passwords and video links from public reads
REVOKE SELECT ON public.replay_schedules FROM anon, authenticated;
GRANT SELECT (id, show_date, description, show_id, created_at)
  ON public.replay_schedules TO anon, authenticated;
GRANT ALL ON public.replay_schedules TO service_role;

-- 4) Reserve the official chat nickname (server-only via service role)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages' AND cmd IN ('INSERT','ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.chat_messages', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone can post chat except reserved names"
ON public.chat_messages FOR INSERT TO anon, authenticated
WITH CHECK (lower(btrim(nickname)) NOT IN ('team live', 'teamlive'));