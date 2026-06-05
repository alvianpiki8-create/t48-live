-- Safe fixes that don't break app architecture
-- 1. show_purchases: remove duplicate open SELECT policy, keep user-scoped
DROP POLICY IF EXISTS "Anyone can read purchases" ON public.show_purchases;

-- 2. coin_topup_requests: restrict SELECT to owning user only.
-- Admin approval already runs via approve-topup edge function with service_role.
DROP POLICY IF EXISTS "Anyone can view topup requests" ON public.coin_topup_requests;
CREATE POLICY "Users can view own topup requests"
  ON public.coin_topup_requests FOR SELECT
  USING (auth.uid() = user_id);