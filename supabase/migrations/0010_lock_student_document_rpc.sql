-- Defense in depth: document chunk retrieval is called only by server routes
-- using the service role. Authenticated browser clients must not invoke it.
revoke execute on function public.match_student_document_chunks(vector, uuid, int) from public;
revoke execute on function public.match_student_document_chunks(vector, uuid, int) from authenticated;
grant execute on function public.match_student_document_chunks(vector, uuid, int) to service_role;

alter function public.match_student_document_chunks(vector, uuid, int)
  security definer;

alter function public.match_student_document_chunks(vector, uuid, int)
  set search_path = public, pg_temp;

-- Bound the caller-controlled result size to prevent unexpectedly large queries.
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
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.document_id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.student_document_chunks c
  where c.document_id = match_document_id
  order by c.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 6), 1), 20);
$$;

revoke execute on function public.match_student_document_chunks(vector, uuid, int) from public;
revoke execute on function public.match_student_document_chunks(vector, uuid, int) from authenticated;
grant execute on function public.match_student_document_chunks(vector, uuid, int) to service_role;
