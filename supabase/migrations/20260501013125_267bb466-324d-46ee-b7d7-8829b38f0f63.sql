-- Admins table (login by name + code)
CREATE TABLE public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL,
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  blocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admins" ON public.admins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert admins" ON public.admins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update admins" ON public.admins FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete admins" ON public.admins FOR DELETE USING (true);

-- Log table for every link admin generated
CREATE TABLE public.admin_link_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  admin_name text NOT NULL,
  link_type text NOT NULL, -- 'normal' | 'membership' | 'show'
  token_code text NOT NULL,
  show_name text,
  duration_days integer,
  access_hour text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_link_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admin link logs" ON public.admin_link_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert admin link logs" ON public.admin_link_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete admin link logs" ON public.admin_link_logs FOR DELETE USING (true);

CREATE INDEX idx_admin_link_logs_admin_id ON public.admin_link_logs(admin_id);
CREATE INDEX idx_admin_link_logs_created_at ON public.admin_link_logs(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_link_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;