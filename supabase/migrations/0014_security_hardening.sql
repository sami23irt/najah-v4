-- Security hardening: database-backed rate limits, least-privilege grants,
-- answer-key isolation, and safe SECURITY DEFINER boundaries.

create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key check (length(bucket_key) between 1 and 200),
  request_count integer not null check (request_count >= 0),
  reset_at timestamptz not null
);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
  current_reset_at timestamptz;
  seconds_left integer;
begin
  if p_bucket_key is null or length(p_bucket_key) < 1 or length(p_bucket_key) > 200
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'Invalid rate limit arguments.' using errcode = '22023';
  end if;

  insert into public.api_rate_limit_buckets(bucket_key, request_count, reset_at)
  values (p_bucket_key, 0, now())
  on conflict (bucket_key) do nothing;

  select b.request_count, b.reset_at
    into current_count, current_reset_at
  from public.api_rate_limit_buckets b
  where b.bucket_key = p_bucket_key
  for update;

  if current_reset_at <= now() then
    update public.api_rate_limit_buckets
    set request_count = 1,
        reset_at = now() + make_interval(secs => p_window_seconds)
    where bucket_key = p_bucket_key;
    return query select true, 0;
  end if;

  if current_count >= p_limit then
    seconds_left := greatest(1, ceil(extract(epoch from (current_reset_at - now())))::integer);
    return query select false, seconds_left;
    return;
  end if;

  update public.api_rate_limit_buckets
  set request_count = request_count + 1
  where bucket_key = p_bucket_key;
  return query select true, 0;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

-- This schema is intentionally not exposed to PostgREST. Only trusted
-- SECURITY DEFINER functions below can invoke this helper with fixed scopes.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.consume_user_rate_limit(
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result_allowed boolean;
begin
  if auth.uid() is null then
    return true;
  end if;

  select allowed into result_allowed
  from public.consume_api_rate_limit(
    'user:' || auth.uid()::text || ':' || p_scope,
    p_limit,
    p_window_seconds
  );
  return coalesce(result_allowed, false);
end;
$$;

-- Never expose the helper itself through the Data API.
revoke all on function private.consume_user_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Keep public questions and the answer key in separate server-owned columns.
-- Existing rows are migrated before the old mixed column is removed.
alter table public.quiz_sessions add column if not exists public_questions jsonb;
alter table public.quiz_sessions add column if not exists answer_key jsonb;

update public.quiz_sessions
set public_questions = (
      select coalesce(jsonb_agg(item.value - 'correctIndex' order by item.ordinality), '[]'::jsonb)
      from jsonb_array_elements(questions) with ordinality as item(value, ordinality)
    ),
    answer_key = questions
where public_questions is null or answer_key is null;

alter table public.quiz_sessions alter column public_questions set not null;
alter table public.quiz_sessions alter column answer_key set not null;
alter table public.quiz_sessions drop column if exists questions;

drop policy if exists "own quiz sessions read" on public.quiz_sessions;
revoke all on table public.quiz_sessions from anon, authenticated;

-- The public leaderboard is served through a deliberately narrow projection
-- function, not by exposing user_id/region/subject columns from the snapshot table.
drop policy if exists "leaderboard is public" on public.leaderboard_snapshots;
revoke all on table public.leaderboard_snapshots from anon, authenticated;

-- Audit records are server-owned and must not be forgeable by arbitrary users.
revoke all on function public.write_audit_log(varchar, varchar, varchar, jsonb)
  from public, anon, authenticated;
grant execute on function public.write_audit_log(varchar, varchar, varchar, jsonb)
  to service_role;

-- Pin search_path for every public SECURITY DEFINER function that may be
-- reachable from the Data API or invoked under elevated privileges.
alter function public.get_public_leaderboard(varchar, integer)
  set search_path = public, pg_temp;
alter function public.audit_room_role_change()
  set search_path = public, pg_temp;
alter function public.audit_room_change()
  set search_path = public, pg_temp;
revoke all on function public.audit_room_role_change() from public, anon, authenticated;
revoke all on function public.audit_room_change() from public, anon, authenticated;

-- The global refresh job is callable only by the scheduler/service role.
revoke all on function public.refresh_all_leaderboards() from public, anon, authenticated;
grant execute on function public.refresh_all_leaderboards() to service_role;
alter function public.refresh_all_leaderboards() set search_path = public, pg_temp;

-- Membership helpers may keep their existing signature for compatibility, but
-- the caller-supplied UUID is ignored so they cannot become an arbitrary-user
-- membership oracle.
create or replace function public.is_room_member(p_room_id int, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_moderator(p_room_id int, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
      and rm.role in ('host', 'moderator')
  );
$$;

-- Remove the access-code hash and message author UUID from client-readable
-- columns while preserving the columns used by the current UI.
revoke select on table public.study_rooms from anon, authenticated;
grant select (
  id, name, description, kind, level, track, subject, max_members,
  timer_phase, timer_ends_at, created_at, updated_at
) on table public.study_rooms to anon, authenticated;

revoke select on table public.room_members from anon, authenticated;
grant select (id, room_id, role, joined_at) on table public.room_members to authenticated;

revoke select on table public.room_messages from anon, authenticated;
grant select (id, room_id, body, created_at) on table public.room_messages to authenticated;

-- Database-enforced limits cover direct browser RPC/Data API calls that never
-- pass through the Next.js route-level limiter.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'room_messages_body_length_check') then
    alter table public.room_messages
      add constraint room_messages_body_length_check check (length(body) between 1 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_rooms_description_length_check') then
    alter table public.study_rooms
      add constraint study_rooms_description_length_check check (description is null or length(description) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_rooms_access_code_consistency_check') then
    alter table public.study_rooms
      add constraint study_rooms_access_code_consistency_check check (
        (kind = 'private' and access_code_hash is not null)
        or (kind = 'open' and access_code_hash is null)
      );
  end if;
end $$;

create index if not exists api_rate_limit_buckets_reset_idx
  on public.api_rate_limit_buckets(reset_at);

create or replace function public.create_study_room(
  p_name varchar,
  p_description text,
  p_kind room_kind,
  p_level school_level,
  p_subject varchar,
  p_access_code text
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_room_id int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not private.consume_user_rate_limit('room-create', 10, 3600) then
    raise exception 'Too many room creations.' using errcode = 'P0001';
  end if;
  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 140 then
    raise exception 'اسم الغرفة غير صالح.';
  end if;
  if p_description is not null and length(p_description) > 2000 then
    raise exception 'وصف الغرفة طويل جداً.' using errcode = '22023';
  end if;
  if p_subject is not null and length(trim(p_subject)) > 120 then
    raise exception 'مادة الغرفة غير صالحة.' using errcode = '22023';
  end if;
  if p_kind = 'private' and (p_access_code is null or length(p_access_code) < 4 or length(p_access_code) > 128) then
    raise exception 'Un code est nécessaire pour une salle privée.';
  end if;

  insert into public.study_rooms (owner_id, name, description, kind, level, subject, access_code_hash)
  values (
    auth.uid(), trim(p_name), nullif(trim(p_description), ''), p_kind, p_level, p_subject,
    case when p_kind = 'private' then encode(digest(p_access_code, 'sha256'), 'hex') else null end
  )
  returning id into new_room_id;

  insert into public.room_members (room_id, user_id, role)
  values (new_room_id, auth.uid(), 'host');
  return new_room_id;
end;
$$;

create or replace function public.join_study_room(p_room_id int, p_access_code text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room_record public.study_rooms%rowtype;
  member_count int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not private.consume_user_rate_limit('room-join', 30, 600) then
    raise exception 'Too many room join attempts.' using errcode = 'P0001';
  end if;

  select * into room_record from public.study_rooms where id = p_room_id for update;
  if not found then raise exception 'Salle introuvable.'; end if;
  if room_record.kind = 'private'
     and (p_access_code is null or encode(digest(p_access_code, 'sha256'), 'hex') <> room_record.access_code_hash) then
    raise exception 'Code d''accès invalide.';
  end if;

  select count(*) into member_count from public.room_members where room_id = p_room_id;
  if member_count >= room_record.max_members
     and not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'La salle a atteint sa capacité maximale.';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;
end;
$$;

create or replace function public.set_room_timer(
  p_room_id int,
  p_phase timer_phase,
  p_duration_seconds int default null
)
returns table(timer_phase timer_phase, timer_ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room_row public.study_rooms%rowtype;
  duration_seconds int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.is_room_moderator(p_room_id, auth.uid()) then
    raise exception 'Not authorized to control this room.' using errcode = '42501';
  end if;
  if not private.consume_user_rate_limit('room-timer:' || p_room_id::text, 60, 60) then
    raise exception 'Too many timer changes.' using errcode = 'P0001';
  end if;

  select * into room_row from public.study_rooms where id = p_room_id for update;
  if not found then raise exception 'Salle introuvable.' using errcode = 'P0002'; end if;

  if p_phase = 'paused' then
    update public.study_rooms
    set timer_phase = 'paused', timer_ends_at = null, updated_at = now()
    where id = p_room_id
    returning public.study_rooms.timer_phase, public.study_rooms.timer_ends_at
    into timer_phase, timer_ends_at;
  else
    duration_seconds := coalesce(p_duration_seconds, case when p_phase = 'focus' then 50 * 60 else 10 * 60 end);
    if duration_seconds < 1 or duration_seconds > 60 * 60 then
      raise exception 'Invalid timer duration.' using errcode = '22023';
    end if;
    update public.study_rooms
    set timer_phase = p_phase,
        timer_ends_at = now() + make_interval(secs => duration_seconds),
        updated_at = now()
    where id = p_room_id
    returning public.study_rooms.timer_phase, public.study_rooms.timer_ends_at
    into timer_phase, timer_ends_at;
  end if;
  return next;
end;
$$;

create or replace function public.record_study_session(
  p_room_id int,
  p_subject varchar,
  p_started_at timestamptz,
  p_completed_at timestamptz
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_session_id int;
  duration_seconds bigint;
  duration_minutes int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not private.consume_user_rate_limit('record-session', 60, 3600) then
    raise exception 'Too many study sessions.' using errcode = 'P0001';
  end if;
  if p_completed_at is null or p_started_at is null or p_completed_at < p_started_at then
    raise exception 'Invalid session timestamps.' using errcode = '22023';
  end if;
  if p_completed_at > now() + interval '5 minutes' or p_completed_at < now() - interval '65 minutes' then
    raise exception 'Session completion time is outside the allowed window.' using errcode = '22023';
  end if;

  duration_seconds := extract(epoch from (p_completed_at - p_started_at))::bigint;
  duration_minutes := round(duration_seconds / 60.0)::int;
  if duration_minutes < 1 or duration_minutes > 60 then
    raise exception 'Session duration must be between 1 and 60 minutes.' using errcode = '22023';
  end if;
  if p_room_id is not null and not public.is_room_member(p_room_id, auth.uid()) then
    raise exception 'User is not a member of this room.' using errcode = '42501';
  end if;

  insert into public.study_sessions (user_id, room_id, subject, duration_minutes, started_at, completed_at)
  values (auth.uid(), p_room_id, nullif(trim(p_subject), ''), duration_minutes, p_started_at, p_completed_at)
  returning id into new_session_id;
  return new_session_id;
end;
$$;

create or replace function public.limit_room_message_rate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not private.consume_user_rate_limit('room-message:' || new.room_id::text, 60, 60) then
    raise exception 'Too many room messages.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists room_messages_rate_limit_trigger on public.room_messages;
create trigger room_messages_rate_limit_trigger
before insert on public.room_messages
for each row execute function public.limit_room_message_rate();

-- Remove the default public EXECUTE privilege from all security-sensitive
-- functions whose explicit grants are defined above or in earlier migrations.
revoke execute on function public.limit_room_message_rate() from public, anon, authenticated;
