
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nickname text NOT NULL,
  user_code text NOT NULL UNIQUE,
  coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to generate unique 6-digit code
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := lpad(floor(random() * 1000000)::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_code = new_code) INTO code_exists;
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname, user_code, coins)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'),
    public.generate_user_code(),
    0
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Show catalog
CREATE TABLE public.show_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  price_coins integer NOT NULL DEFAULT 4,
  show_date timestamptz,
  lineup text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.show_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view shows" ON public.show_catalog FOR SELECT USING (true);
CREATE POLICY "Anyone can manage shows" ON public.show_catalog FOR ALL USING (true) WITH CHECK (true);

-- Show purchases
CREATE TABLE public.show_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  show_id uuid REFERENCES public.show_catalog(id) ON DELETE CASCADE NOT NULL,
  coins_spent integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, show_id)
);

ALTER TABLE public.show_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.show_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON public.show_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can read purchases" ON public.show_purchases FOR SELECT USING (true);

-- Coin top-up requests
CREATE TABLE public.coin_topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  total_price integer NOT NULL,
  topup_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

ALTER TABLE public.coin_topup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view topup requests" ON public.coin_topup_requests FOR SELECT USING (true);
CREATE POLICY "Users can create topup requests" ON public.coin_topup_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can update topup requests" ON public.coin_topup_requests FOR UPDATE USING (true) WITH CHECK (true);

-- Replay schedules
CREATE TABLE public.replay_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_date date NOT NULL,
  replay_password text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.replay_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view replay schedules" ON public.replay_schedules FOR SELECT USING (true);
CREATE POLICY "Anyone can manage replay schedules" ON public.replay_schedules FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.show_catalog;
ALTER PUBLICATION supabase_realtime ADD TABLE public.show_purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_topup_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.replay_schedules;
