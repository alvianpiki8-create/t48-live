-- Create access_tokens table
CREATE TABLE public.access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_code TEXT NOT NULL UNIQUE,
  device_id TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT
);

-- Enable RLS
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access for token validation
CREATE POLICY "Anyone can validate tokens" ON public.access_tokens
  FOR SELECT USING (true);

-- Allow anonymous update for device binding
CREATE POLICY "Anyone can bind device to token" ON public.access_tokens
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Allow insert for token creation (owner panel)
CREATE POLICY "Anyone can create tokens" ON public.access_tokens
  FOR INSERT WITH CHECK (true);

-- Create index for fast token lookup
CREATE INDEX idx_access_tokens_token_code ON public.access_tokens(token_code);
CREATE INDEX idx_access_tokens_is_blocked ON public.access_tokens(is_blocked);