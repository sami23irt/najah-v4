-- Finalize a quiz and persist its attempt atomically. The route performs
-- validation of the submitted answers, while this function owns the critical
-- session update + attempt insert transaction.
create or replace function public.finalize_quiz_session(
  p_session_id uuid,
  p_user_id uuid,
  p_correct_answers integer
)
returns table(correct_answers integer, total_questions integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row public.quiz_sessions%rowtype;
begin
  if p_user_id is null then
    raise exception 'User is required.' using errcode = '42501';
  end if;

  select * into session_row
  from public.quiz_sessions
  where id = p_session_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Quiz session not found.' using errcode = 'P0002';
  end if;
  if session_row.submitted_at is not null then
    raise exception 'Quiz session already submitted.' using errcode = '23505';
  end if;
  if session_row.expires_at < now() then
    raise exception 'Quiz session expired.' using errcode = '22023';
  end if;
  if p_correct_answers < 0 or p_correct_answers > session_row.total_questions then
    raise exception 'Invalid quiz score.' using errcode = '22023';
  end if;

  update public.quiz_sessions
  set correct_answers = p_correct_answers,
      submitted_at = now()
  where id = session_row.id;

  insert into public.quiz_attempts(
    user_id,
    level,
    subject,
    document_id,
    total_questions,
    correct_answers,
    curriculum_reference
  ) values (
    session_row.user_id,
    session_row.level,
    session_row.subject,
    session_row.document_id,
    session_row.total_questions,
    p_correct_answers,
    case when session_row.document_id is not null then 'AI-DOCUMENT-RAG' else 'AI-RAG' end
  );

  return query select p_correct_answers, session_row.total_questions;
end;
$$;

revoke execute on function public.finalize_quiz_session(uuid, uuid, integer) from public;
revoke execute on function public.finalize_quiz_session(uuid, uuid, integer) from anon;
revoke execute on function public.finalize_quiz_session(uuid, uuid, integer) from authenticated;
grant execute on function public.finalize_quiz_session(uuid, uuid, integer) to service_role;
