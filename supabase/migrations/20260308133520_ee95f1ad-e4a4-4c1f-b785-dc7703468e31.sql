
-- Fix RLS: Drop all existing policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Public access conversations" ON public.conversations;
DROP POLICY IF EXISTS "Public access documents" ON public.documents;
DROP POLICY IF EXISTS "Public access messages" ON public.messages;

CREATE POLICY "Public access conversations" ON public.conversations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access documents" ON public.documents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access messages" ON public.messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Fix storage policies: drop and recreate for both buckets
DROP POLICY IF EXISTS "Public upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read documents" ON storage.objects;
DROP POLICY IF EXISTS "Public delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Public update documents" ON storage.objects;

CREATE POLICY "Anon upload storage" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id IN ('documents', 'files'));
CREATE POLICY "Anon read storage" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id IN ('documents', 'files'));
CREATE POLICY "Anon delete storage" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id IN ('documents', 'files'));
CREATE POLICY "Anon update storage" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id IN ('documents', 'files')) WITH CHECK (bucket_id IN ('documents', 'files'));

-- Ensure files bucket exists
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO UPDATE SET public = true;
