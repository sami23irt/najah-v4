begin;

-- Evaluate auth.uid() once per statement instead of once per row.
drop policy if exists "own profile" on public.student_profiles;
create policy "own profile" on public.student_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "members write messages" on public.room_messages;
create policy "members write messages" on public.room_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_room_member(room_id)
  );

drop policy if exists "own study sessions read" on public.study_sessions;
create policy "own study sessions read" on public.study_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own quiz attempts read" on public.quiz_attempts;
create policy "own quiz attempts read" on public.quiz_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own quiz sessions read" on public.quiz_sessions;
create policy "own quiz sessions read" on public.quiz_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own documents read" on public.student_documents;
create policy "own documents read" on public.student_documents
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own document chunks read" on public.student_document_chunks;
create policy "own document chunks read" on public.student_document_chunks
  for select to authenticated
  using (
    exists (
      select 1
      from public.student_documents d
      where d.id = document_id
        and d.user_id = (select auth.uid())
    )
  );

-- Cover foreign keys used by ownership and cascading-deletion checks.
create index if not exists quiz_attempts_document_id_idx
  on public.quiz_attempts(document_id);
create index if not exists quiz_sessions_document_id_idx
  on public.quiz_sessions(document_id);
create index if not exists room_messages_user_id_idx
  on public.room_messages(user_id);
create index if not exists study_rooms_owner_id_idx
  on public.study_rooms(owner_id);
create index if not exists study_sessions_room_id_idx
  on public.study_sessions(room_id);

commit;
