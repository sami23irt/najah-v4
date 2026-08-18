-- Security hardening for room RPCs, Realtime Presence, timer state and study sessions.
-- This migration assumes the UUID user-id migration in 0001_rag_and_rls.sql has been applied.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Room authorization helpers. SECURITY DEFINER avoids RLS recursion when a
-- policy needs to ask whether the current user is already a room member.
-- ---------------------------------------------------------------------------
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
      and rm.user_id = p_user_id
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
      and rm.user_id = p_user_id
      and rm.role in ('host', 'moderator')
  );
$$;

revoke execute on function public.is_room_member(int, uuid) from public;
revoke execute on function public.is_room_moderator(int, uuid) from public;
grant execute on function public.is_room_member(int, uuid) to authenticated;
grant execute on function public.is_room_moderator(int, uuid) to authenticated;

-- Do not leave a broad UPDATE policy on study_rooms. Timer mutations are
-- performed only through the narrowly scoped RPC below.
drop policy if exists "host or moderator updates room" on public.study_rooms;

-- ---------------------------------------------------------------------------
-- Atomic timer mutation. The server/database clock is authoritative and the
-- row lock prevents two moderators from racing each other.
-- ---------------------------------------------------------------------------
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

  select * into room_row
  from public.study_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Salle introuvable.' using errcode = 'P0002';
  end if;

  if p_phase = 'paused' then
    update public.study_rooms
    set timer_phase = 'paused', timer_ends_at = null, updated_at = now()
    where id = p_room_id
    returning public.study_rooms.timer_phase, public.study_rooms.timer_ends_at
    into timer_phase, timer_ends_at;
  else
    duration_seconds := coalesce(p_duration_seconds,
      case when p_phase = 'focus' then 50 * 60 else 10 * 60 end);

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

revoke execute on function public.set_room_timer(int, timer_phase, int) from public;
grant execute on function public.set_room_timer(int, timer_phase, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-derived study duration. The client may provide timestamps, but the
-- database derives duration_minutes and refuses future/far-past fake sessions.
-- ---------------------------------------------------------------------------
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

  if p_completed_at is null or p_started_at is null or p_completed_at < p_started_at then
    raise exception 'Invalid session timestamps.' using errcode = '22023';
  end if;

  -- A recorded session must end near server time. This prevents replaying old
  -- timestamps to manufacture leaderboard points. Five minutes allows clock
  -- skew/network delay; sessions themselves are capped at 60 minutes.
  if p_completed_at > now() + interval '5 minutes'
     or p_completed_at < now() - interval '65 minutes' then
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

  insert into public.study_sessions (
    user_id, room_id, subject, duration_minutes, started_at, completed_at
  ) values (
    auth.uid(), p_room_id, nullif(trim(p_subject), ''), duration_minutes, p_started_at, p_completed_at
  )
  returning id into new_session_id;

  return new_session_id;
end;
$$;

revoke execute on function public.record_study_session(int, varchar, timestamptz, timestamptz) from public;
grant execute on function public.record_study_session(int, varchar, timestamptz, timestamptz) to authenticated;

-- No direct client INSERT/UPDATE/DELETE on study_sessions.
drop policy if exists "own study sessions" on public.study_sessions;
drop policy if exists "own study sessions read" on public.study_sessions;
create policy "own study sessions read" on public.study_sessions
  for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime Presence: only authenticated members of room:<id> can connect to,
-- publish, and receive Presence state. Broadcast is not used for timer/chat.
-- ---------------------------------------------------------------------------
drop policy if exists "room members can receive presence" on realtime.messages;
drop policy if exists "room members can send presence" on realtime.messages;

create policy "room members can receive presence"
on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and realtime.topic() ~ '^room:[0-9]+$'
  and public.is_room_member(split_part(realtime.topic(), ':', 2)::int)
);

create policy "room members can send presence"
on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and realtime.topic() ~ '^room:[0-9]+$'
  and public.is_room_member(split_part(realtime.topic(), ':', 2)::int)
);

-- Defense-in-depth constraints: even service-role maintenance jobs cannot
-- persist nonsensical study durations or reversed timestamps.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_sessions_duration_valid') then
    alter table public.study_sessions
      add constraint study_sessions_duration_valid check (duration_minutes between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_sessions_time_order_valid') then
    alter table public.study_sessions
      add constraint study_sessions_time_order_valid check (completed_at is null or completed_at >= started_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_attempts_answers_valid') then
    alter table public.quiz_attempts
      add constraint quiz_attempts_answers_valid check (correct_answers between 0 and total_questions);
  end if;
end $$;
