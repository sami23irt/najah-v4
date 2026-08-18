-- Najah V2 completion: audit logs, account deletion support, and server-owned quiz sessions.

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid null,
  event_type varchar(80) not null,
  target_type varchar(80),
  target_id varchar(120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);

-- Audit records must survive account deletion, so there is intentionally no FK to auth.users.
alter table public.audit_logs enable row level security;

create or replace function public.write_audit_log(
  p_event_type varchar,
  p_target_type varchar default null,
  p_target_id varchar default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  insert into public.audit_logs(actor_user_id, event_type, target_type, target_id, metadata)
  values (auth.uid(), left(p_event_type,80), left(p_target_type,80), left(p_target_id,120), coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke execute on function public.write_audit_log(varchar,varchar,varchar,jsonb) from public;
grant execute on function public.write_audit_log(varchar,varchar,varchar,jsonb) to authenticated;

-- Role changes are sensitive and should be recorded even when made by an RPC/admin path.
create or replace function public.audit_room_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    insert into public.audit_logs(actor_user_id,event_type,target_type,target_id,metadata)
    values (auth.uid(),'room_role_changed','room_member',new.id::text,
      jsonb_build_object('room_id',new.room_id,'member_user_id',new.user_id,'old_role',old.role,'new_role',new.role));
  end if;
  return new;
end;
$$;
drop trigger if exists audit_room_role_change_trigger on public.room_members;
create trigger audit_room_role_change_trigger after update of role on public.room_members
for each row execute function public.audit_room_role_change();

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level school_level not null,
  subject varchar(120) not null,
  questions jsonb not null,
  total_questions integer not null check (total_questions between 1 and 20),
  correct_answers integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  submitted_at timestamptz,
  check (correct_answers is null or (correct_answers between 0 and total_questions))
);
create index if not exists quiz_sessions_user_idx on public.quiz_sessions(user_id, created_at desc);
alter table public.quiz_sessions enable row level security;
create policy "own quiz sessions read" on public.quiz_sessions for select to authenticated using (auth.uid() = user_id);

-- No client INSERT/UPDATE/DELETE policy: quiz creation/submission stays server-owned.

-- Log file access and timer changes as sensitive events through existing server-side routes/RPCs.


create or replace function public.audit_room_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor_user_id,event_type,target_type,target_id,metadata)
    values (auth.uid(),'room_created','study_room',new.id::text,jsonb_build_object('name',new.name,'kind',new.kind));
  elsif tg_op = 'UPDATE' and (old.timer_phase is distinct from new.timer_phase or old.timer_ends_at is distinct from new.timer_ends_at) then
    insert into public.audit_logs(actor_user_id,event_type,target_type,target_id,metadata)
    values (auth.uid(),'room_timer_changed','study_room',new.id::text,jsonb_build_object('phase',new.timer_phase,'ends_at',new.timer_ends_at));
  end if;
  return new;
end;
$$;
drop trigger if exists audit_room_change_trigger on public.study_rooms;
create trigger audit_room_change_trigger after insert or update of timer_phase,timer_ends_at on public.study_rooms
for each row execute function public.audit_room_change();
