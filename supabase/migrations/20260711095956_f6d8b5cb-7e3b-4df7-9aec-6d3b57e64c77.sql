
ALTER TABLE public.access_tokens ADD COLUMN IF NOT EXISTS max_uses INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.access_token_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.access_tokens(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_token_devices TO anon, authenticated;
GRANT ALL ON public.access_token_devices TO service_role;
ALTER TABLE public.access_token_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read token devices" ON public.access_token_devices FOR SELECT USING (true);
CREATE POLICY "Public can insert token devices" ON public.access_token_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can delete token devices" ON public.access_token_devices FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS access_token_devices_token_idx ON public.access_token_devices(token_id);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS chat_messages_pinned_idx ON public.chat_messages(is_pinned) WHERE is_pinned = true;
