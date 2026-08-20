-- Real backing for the "study" workspace (PDF importer + YouTube importer +
-- AI copilot + quiz generator on the imported document). Before this
-- migration, app/study/page.tsx was a UI-only prototype with a client-side
-- setTimeout() and a hardcoded quiz — nothing was extracted, embedded, or
-- stored. This adds the actual ingestion + RAG pipeline for user-uploaded
-- material, mirroring the existing curriculum RAG pipeline (0001_rag_and_rls.sql)
-- but scoped to one student's own document instead of the shared knowledge base.

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(255) not null,
  source_type varchar(20) not null check (source_type in ('pdf', 'youtube')),
  storage_path varchar(500),
  source_url varchar(500),
  status varchar(20) not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error_message text,
  summary jsonb,
  char_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_documents_user_idx on public.student_documents(user_id, created_at desc);
alter table public.student_documents enable row level security;
create policy "own documents read" on public.student_documents for select to authenticated using (auth.uid() = user_id);
-- No client insert/update/delete policy: ingestion is entirely server-owned
-- (service role only) so extraction/embedding can't be spoofed from the browser.

create table if not exists public.student_document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.student_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index if not exists student_document_chunks_doc_idx on public.student_document_chunks(document_id, chunk_index);
alter table public.student_document_chunks enable row level security;
create policy "own document chunks read" on public.student_document_chunks for select to authenticated using (
  exists (select 1 from public.student_documents d where d.id = document_id and d.user_id = auth.uid())
);

-- Vector similarity search scoped to one document. Ownership of that document
-- is verified in application code (service client + .eq("user_id", ...))
-- before this is ever called, same pattern used by app/api/quizzes/submit.
create or replace function public.match_student_document_chunks(
  query_embedding vector(768),
  match_document_id uuid,
  match_count int default 6
)
returns table (
  chunk_id bigint,
  document_id uuid,
  content text,
  similarity float
)
language sql
stable
set search_path = public, pg_temp
as $$
  select c.id, c.document_id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.student_document_chunks c
  where c.document_id = match_document_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_student_document_chunks(vector, uuid, int) from public;
grant execute on function public.match_student_document_chunks(vector, uuid, int) to authenticated, service_role;

-- Private bucket for uploaded PDFs; only the server (service role) reads/writes,
-- same pattern as the 'exams' bucket in 0005_exam_storage.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-uploads', 'study-uploads', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

-- quiz_sessions/quiz_attempts previously assumed every quiz maps to a
-- curriculum level (they were always generated from level+subject). A quiz
-- generated from a student's own uploaded document doesn't have a curriculum
-- level, so level becomes optional and both tables gain an optional link
-- back to the source document.
alter table public.quiz_sessions alter column level drop not null;
alter table public.quiz_sessions add column if not exists document_id uuid references public.student_documents(id) on delete cascade;

alter table public.quiz_attempts alter column level drop not null;
alter table public.quiz_attempts add column if not exists document_id uuid references public.student_documents(id) on delete set null;
