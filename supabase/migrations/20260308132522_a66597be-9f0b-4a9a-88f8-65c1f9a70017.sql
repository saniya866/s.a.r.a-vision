
-- Fix: Drop restrictive policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Allow all for conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow all for documents" ON public.documents;
DROP POLICY IF EXISTS "Allow all for messages" ON public.messages;

CREATE POLICY "Public access conversations" ON public.conversations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access documents" ON public.documents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access messages" ON public.messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create storage bucket 'files' if not exists
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for 'documents' bucket
DROP POLICY IF EXISTS "Public upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read documents" ON storage.objects;
DROP POLICY IF EXISTS "Public delete documents" ON storage.objects;

CREATE POLICY "Public upload documents" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id IN ('documents', 'files'));
CREATE POLICY "Public read documents" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id IN ('documents', 'files'));
CREATE POLICY "Public delete documents" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id IN ('documents', 'files'));
CREATE POLICY "Public update documents" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id IN ('documents', 'files')) WITH CHECK (bucket_id IN ('documents', 'files'));
