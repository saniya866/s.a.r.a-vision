
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow anon select on documents bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon insert on documents bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon update on documents bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon delete on documents bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon select on files bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon insert on files bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon update on files bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon delete on files bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Public access on documents bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Public access on files bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Full public access storage" ON storage.objects;
END $$;

CREATE POLICY "Full public access storage"
ON storage.objects FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access documents" ON public.documents;
DROP POLICY IF EXISTS "Public access documents " ON public.documents;
CREATE POLICY "Public access documents"
ON public.documents FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access conversations" ON public.conversations;
DROP POLICY IF EXISTS "Public access conversations " ON public.conversations;
CREATE POLICY "Public access conversations"
ON public.conversations FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access messages" ON public.messages;
DROP POLICY IF EXISTS "Public access messages " ON public.messages;
CREATE POLICY "Public access messages"
ON public.messages FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
