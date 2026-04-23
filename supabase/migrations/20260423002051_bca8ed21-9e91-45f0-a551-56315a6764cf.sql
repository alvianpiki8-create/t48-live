ALTER TABLE public.show_purchases
ADD COLUMN IF NOT EXISTS token_code text;

ALTER TABLE public.access_tokens
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS show_id uuid;

CREATE INDEX IF NOT EXISTS idx_show_purchases_token_code ON public.show_purchases(token_code);
CREATE INDEX IF NOT EXISTS idx_access_tokens_show_id ON public.access_tokens(show_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_user_id ON public.access_tokens(user_id);