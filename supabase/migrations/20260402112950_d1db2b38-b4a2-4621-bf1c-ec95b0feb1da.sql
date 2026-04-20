
-- Memberships table
CREATE TABLE public.memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'weekly' CHECK (type IN ('weekly', 'monthly')),
  price INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read memberships" ON public.memberships FOR SELECT USING (true);
CREATE POLICY "Anyone can insert memberships" ON public.memberships FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update memberships" ON public.memberships FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete memberships" ON public.memberships FOR DELETE USING (true);

-- Add public_link to stream_settings
ALTER TABLE public.stream_settings ADD COLUMN IF NOT EXISTS public_link_enabled BOOLEAN NOT NULL DEFAULT false;

-- Enable realtime for memberships
ALTER PUBLICATION supabase_realtime ADD TABLE public.memberships;
