-- Add delete policy for token management
CREATE POLICY "Anyone can delete tokens" ON public.access_tokens
  FOR DELETE USING (true);