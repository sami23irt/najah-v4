begin;

-- Keep extensions out of the exposed public schema.
alter extension vector set schema extensions;

-- Explicit function grants: only the roles that need each RPC may execute it.
revoke all on function public.create_study_room(varchar, text, public.room_kind, public.school_level, varchar, text)
  from public, anon;
grant execute on function public.create_study_room(varchar, text, public.room_kind, public.school_level, varchar, text)
  to authenticated;

revoke all on function public.join_study_room(integer, text)
  from public, anon;
grant execute on function public.join_study_room(integer, text) to authenticated;

revoke all on function public.set_room_timer(integer, public.timer_phase, integer)
  from public, anon;
grant execute on function public.set_room_timer(integer, public.timer_phase, integer)
  to authenticated;

revoke all on function public.record_study_session(integer, varchar, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.record_study_session(integer, varchar, timestamptz, timestamptz)
  to authenticated;

revoke all on function public.is_room_member(integer, uuid)
  from public, anon;
grant execute on function public.is_room_member(integer, uuid) to authenticated;

revoke all on function public.is_room_moderator(integer, uuid)
  from public, anon;
grant execute on function public.is_room_moderator(integer, uuid) to authenticated;

revoke all on function public.match_curriculum_chunks(extensions.vector, public.school_level, varchar, integer)
  from public, anon, authenticated;
grant execute on function public.match_curriculum_chunks(extensions.vector, public.school_level, varchar, integer)
  to service_role;

revoke all on function public.match_student_document_chunks(extensions.vector, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.match_student_document_chunks(extensions.vector, uuid, integer)
  to service_role;

-- This helper is not an application RPC and must never be callable through PostgREST.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Keep sensitive tables inaccessible through the Data API; server-side service-role
-- code and RLS-backed application paths retain the privileges they need.
revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;
revoke all on table public.curriculum_documents from public, anon, authenticated;
revoke all on table public.curriculum_chunks from public, anon, authenticated;
revoke all on table public.leaderboard_snapshots from public, anon, authenticated;

commit;
