-- Timer update authorization is defined in 0001_rag_and_rls.sql.
-- Keep this migration idempotent for databases that already applied 0004.
drop policy if exists "host or moderator updates room" on study_rooms;

create policy "host or moderator updates room" on study_rooms
  for update to authenticated
  using (public.is_room_moderator(id))
  with check (public.is_room_moderator(id));
