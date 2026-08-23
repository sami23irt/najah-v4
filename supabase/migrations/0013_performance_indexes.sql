-- Performance indexes for production retrieval and public archive filtering.
-- These indexes are additive and safe to apply after the existing RAG migrations.

-- The student-document RPC orders by cosine distance. Without this index,
-- every chat question scans all chunks belonging to the document.
create index if not exists student_document_chunks_embedding_idx
  on public.student_document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- The curriculum RPC filters the parent table by level and subject before
-- joining to chunks.
create index if not exists curriculum_documents_level_subject_idx
  on public.curriculum_documents(level, subject, id);

-- Archive pages only expose published exams and filter by these dimensions.
-- The partial index keeps unpublished/admin rows out of the public lookup path.
create index if not exists exams_published_filter_idx
  on public.exams(level, track, subject, region, year desc)
  where is_published = true;

-- Speeds up the user's document list and status filtering during ingestion.
create index if not exists student_documents_user_status_idx
  on public.student_documents(user_id, status, created_at desc);

-- Helps cleanup and operational queries for expired quiz sessions.
create index if not exists quiz_sessions_expiry_idx
  on public.quiz_sessions(expires_at)
  where submitted_at is null;
