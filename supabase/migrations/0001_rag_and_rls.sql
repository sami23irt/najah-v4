-- Enable pgvector for RAG embeddings
create extension if not exists vector;
create extension if not exists pgcrypto;

-- student_profiles.user_id references Supabase's own auth.users
alter table student_profiles
  add constraint student_profiles_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table study_rooms
  add constraint study_rooms_owner_fk
  foreign key (owner_id) references auth.users(id) on delete cascade;

alter table room_members
  add constraint room_members_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table room_messages
  add constraint room_messages_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table study_sessions
  add constraint study_sessions_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table quiz_attempts
  add constraint quiz_attempts_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table leaderboard_snapshots
  add constraint leaderboard_snapshots_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ivfflat index for approximate nearest-neighbour search over curriculum chunks.
-- lists = 100 is a reasonable default up to ~1M rows; retune once the corpus is known.
create index if not exists curriculum_chunks_embedding_idx
  on curriculum_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Retrieval function used by lib/rag.ts. SECURITY DEFINER so it can read
-- curriculum_chunks even under RLS (the table itself is admin-write, public-read
-- only through this function, never through a raw select from the client).
create or replace function match_curriculum_chunks(
  query_embedding vector(768),
  match_level school_level,
  match_subject varchar,
  match_count int default 5
)
returns table (
  chunk_id int,
  document_id int,
  document_title varchar,
  content text,
  similarity float
)
language sql stable
security definer
set search_path = public
as $$
  select
    cc.id as chunk_id,
    cc.document_id,
    cd.title as document_title,
    cc.content,
    1 - (cc.embedding <=> query_embedding) as similarity
  from curriculum_chunks cc
  join curriculum_documents cd on cd.id = cc.document_id
  where cd.level = match_level
    and cd.subject = match_subject
  order by cc.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function match_curriculum_chunks(vector(768), school_level, varchar, int) from public;
grant execute on function match_curriculum_chunks(vector(768), school_level, varchar, int) to service_role;

-- ---- Row Level Security -----------------------------------------------------
alter table student_profiles enable row level security;
alter table study_rooms enable row level security;
alter table room_members enable row level security;
alter table room_messages enable row level security;
alter table study_sessions enable row level security;
alter table quiz_attempts enable row level security;
alter table leaderboard_snapshots enable row level security;
alter table exams enable row level security;
alter table exam_files enable row level security;
alter table curriculum_documents enable row level security;
alter table curriculum_chunks enable row level security;

-- Students can only read/write their own profile.
create policy "own profile" on student_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Published exams/files are public read; writes are admin-only (service role).
create policy "published exams are public" on exams
  for select using (is_published = true);
create policy "exam files follow published exam" on exam_files
  for select using (exists (select 1 from exams e where e.id = exam_id and e.is_published = true));

-- SECURITY DEFINER helpers avoid recursive RLS policies when checking membership.
create or replace function public.is_room_member(p_room_id int, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
  );
$$;

create or replace function public.is_room_moderator(p_room_id int, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
      and rm.role in ('host', 'moderator')
  );
$$;

revoke execute on function public.is_room_member(int, uuid) from public;
revoke execute on function public.is_room_moderator(int, uuid) from public;
grant execute on function public.is_room_member(int, uuid) to authenticated;
grant execute on function public.is_room_moderator(int, uuid) to authenticated;

-- Rooms: open rooms are publicly listable; private rooms are only visible to members.
create policy "open rooms are public" on study_rooms
  for select using (kind = 'open' or public.is_room_member(id));

create policy "authenticated users can create rooms" on study_rooms
  for insert to authenticated
  with check (auth.uid() = owner_id);

-- Room membership / messages: only visible to members of that room.
create policy "members see membership" on room_members
  for select using (public.is_room_member(room_id));

create policy "members read messages" on room_messages
  for select using (public.is_room_member(room_id));

create policy "members write messages" on room_messages
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.is_room_member(room_id)
  );

create policy "host or moderator updates room" on study_rooms
  for update to authenticated
  using (public.is_room_moderator(id))
  with check (public.is_room_moderator(id));

-- Supabase Realtime authorization for private room channels. Chat and timer
-- state use Postgres Changes, so their authorization comes from the underlying
-- table RLS. Presence still needs explicit Realtime policies.
create policy "room members can receive presence" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() ~ '^room:[0-9]+$'
    and public.is_room_member(split_part(realtime.topic(), ':', 2)::int)
    and realtime.messages.extension = 'presence'
  );

create policy "room members can send presence" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() ~ '^room:[0-9]+$'
    and public.is_room_member(split_part(realtime.topic(), ':', 2)::int)
    and realtime.messages.extension = 'presence'
  );

-- Study data is private to the owning student.
create policy "own study sessions read" on study_sessions
  for select using (auth.uid() = user_id);
create policy "own quiz attempts read" on quiz_attempts
  for select using (auth.uid() = user_id);
-- Inserts/updates/deletes are performed by the server-side record API using
-- the service role, so clients cannot forge leaderboard activity directly.

-- Leaderboard snapshots: public read (it's a public honour board), writes only
-- via the service-role refresh job — no client insert/update policy exists,
-- which is what actually enforces "no client-side score tampering".
create policy "leaderboard is public" on leaderboard_snapshots
  for select using (true);



create or replace function public.get_public_leaderboard(p_period_key varchar, p_limit int default 5)
returns table (
  score bigint,
  pseudonym varchar,
  show_pseudonym boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sum(ls.score)::bigint as score,
    max(sp.pseudonym) filter (where sp.show_pseudonym = true) as pseudonym,
    coalesce(bool_or(sp.show_pseudonym), false) as show_pseudonym
  from leaderboard_snapshots ls
  left join student_profiles sp on sp.user_id = ls.user_id
  where ls.period_key = p_period_key
  group by ls.user_id
  order by sum(ls.score) desc
  limit least(greatest(coalesce(p_limit, 5), 1), 50);
$$;

revoke execute on function public.get_public_leaderboard(varchar, int) from public;
grant execute on function public.get_public_leaderboard(varchar, int) to anon, authenticated;

-- Curriculum knowledge base: never exposed directly to clients. Reads only
-- go through match_curriculum_chunks() (security definer, called from the
-- server-side copilot route with the service key). No select policy is
-- added on purpose, so RLS blocks direct client reads entirely.
