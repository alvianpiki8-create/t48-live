
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
    CASE 
      WHEN NEW.email IN ('owner@teamlive.com', 'admin2@teamlive.com') THEN '123323'
      ELSE public.generate_user_code()
    END,
    CASE
      WHEN NEW.email IN ('owner@teamlive.com', 'admin2@teamlive.com') THEN 999999
      ELSE 0
    END
  );
  RETURN NEW;
END;
$$;
