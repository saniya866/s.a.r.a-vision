-- Drop restrictive RLS policies and replace with permissive ones

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Allow all for conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Allow all for documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Allow all for messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.documents ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.documents ALTER COLUMN user_id SET DEFAULT null;
ALTER TABLE public.conversations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user_id SET DEFAULT null;
ALTER TABLE public.messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN user_id SET DEFAULT null;