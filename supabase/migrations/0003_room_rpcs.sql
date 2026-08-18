create or replace function create_study_room(
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
set search_path = public
as $$
declare
  new_room_id int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 140 then
    raise exception 'اسم الغرفة غير صالح.';
  end if;

  if p_kind = 'private' and (p_access_code is null or length(p_access_code) < 4) then
    raise exception 'Un code est nécessaire pour une salle privée.';
  end if;

  insert into study_rooms (owner_id, name, description, kind, level, subject, access_code_hash)
  values (
    auth.uid(),
    trim(p_name),
    nullif(trim(p_description), ''),
    p_kind,
    p_level,
    p_subject,
    case when p_kind = 'private' then encode(digest(p_access_code, 'sha256'), 'hex') else null end
  )
  returning id into new_room_id;

  insert into room_members (room_id, user_id, role)
  values (new_room_id, auth.uid(), 'host');

  return new_room_id;
end;
$$;

revoke execute on function create_study_room(varchar, text, room_kind, school_level, varchar, text) from public;
grant execute on function create_study_room(varchar, text, room_kind, school_level, varchar, text) to authenticated;

create or replace function join_study_room(p_room_id int, p_access_code text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room_record study_rooms%rowtype;
  member_count int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into room_record from study_rooms where id = p_room_id for update;
  if not found then
    raise exception 'Salle introuvable.';
  end if;

  if room_record.kind = 'private'
     and (p_access_code is null or encode(digest(p_access_code, 'sha256'), 'hex') != room_record.access_code_hash) then
    raise exception 'Code d''accès invalide.';
  end if;

  select count(*) into member_count from room_members where room_id = p_room_id;
  if member_count >= room_record.max_members
     and not exists (select 1 from room_members where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'La salle a atteint sa capacité maximale.';
  end if;

  insert into room_members (room_id, user_id, role)
  values (p_room_id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;
end;
$$;

revoke execute on function join_study_room(int, text) from public;
grant execute on function join_study_room(int, text) to authenticated;
