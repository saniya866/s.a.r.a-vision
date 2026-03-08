DO $$
BEGIN
  DROP POLICY IF EXISTS "Public access documents " ON public.documents;
  DROP POLICY IF EXISTS "Public access documents" ON public.documents;
  DROP POLICY IF EXISTS "Public access conversations " ON public.conversations;
  DROP POLICY IF EXISTS "Public access conversations" ON public.conversations;
  DROP POLICY IF EXISTS "Public access messages " ON public.messages;
  DROP POLICY IF EXISTS "Public access messages" ON public.messages;
  DROP POLICY IF EXISTS "Full public access storage" ON storage.objects;
END $$;

CREATE POLICY "Full access documents"
ON public.documents FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Full access conversations"
ON public.conversations FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Full access messages"
ON public.messages FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Full access storage objects"
ON storage.objects FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);