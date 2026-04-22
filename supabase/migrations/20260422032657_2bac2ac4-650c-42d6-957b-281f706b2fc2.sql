CREATE TABLE IF NOT EXISTS public.user_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  membership_name TEXT NOT NULL,
  membership_type TEXT NOT NULL,
  coins_spent INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  replay_url TEXT,
  replay_password TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memberships"
ON public.user_memberships
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memberships"
ON public.user_memberships
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_memberships_user_expires
ON public.user_memberships (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.livestream_trials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  cooldown_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.livestream_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view livestream trials"
ON public.livestream_trials
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create livestream trials"
ON public.livestream_trials
FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_livestream_trials_device_created
ON public.livestream_trials (device_id, created_at DESC);