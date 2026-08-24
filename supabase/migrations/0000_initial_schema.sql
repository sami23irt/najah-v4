-- Initial PostgreSQL schema for the Supabase project.
-- The feature migrations below assume these tables and enum types already exist.

create extension if not exists vector;
create extension if not exists pgcrypto;

create type public.school_level as enum ('3AC', 'TRC', '1BAC', '2BAC');
create type public.room_kind as enum ('open', 'private');
create type public.room_role as enum ('host', 'moderator', 'member');
create type public.timer_phase as enum ('focus', 'break', 'paused');
create type public.exam_type as enum ('regional', 'national', 'school');
create type public.exam_session as enum ('normal', 'makeup');
create type public.file_kind as enum ('subject', 'correction', 'resource');
create type public.locale as enum ('ar', 'fr');

create table public.student_profiles (
  id serial primary key,
  user_id uuid not null,
  level public.school_level,
  track varchar(120),
  region varchar(120),
  institution varchar(160),
  pseudonym varchar(50),
  show_pseudonym boolean not null default true,
  preferred_locale public.locale not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index student_profiles_user_id_unique on public.student_profiles(user_id);
create index student_profiles_level_region_idx on public.student_profiles(level, region);

create table public.exams (
  id serial primary key,
  title varchar(255) not null,
  level public.school_level not null,
  track varchar(120),
  subject varchar(120) not null,
  region varchar(120),
  exam_type public.exam_type not null,
  session public.exam_session not null,
  year integer not null,
  curriculum_reference varchar(255),
  source_url varchar(500),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exams_filter_idx on public.exams(level, subject, region, year);
create index exams_publication_idx on public.exams(is_published, year);

create table public.exam_files (
  id serial primary key,
  exam_id integer not null references public.exams(id) on delete cascade,
  kind public.file_kind not null,
  storage_path varchar(500) not null,
  file_name varchar(255) not null,
  mime_type varchar(100) not null default 'application/pdf',
  created_at timestamptz not null default now()
);
create index exam_files_exam_idx on public.exam_files(exam_id, kind);

create table public.study_rooms (
  id serial primary key,
  owner_id uuid not null,
  name varchar(140) not null,
  description text,
  kind public.room_kind not null,
  level public.school_level,
  track varchar(120),
  subject varchar(120),
  max_members integer not null default 12,
  access_code_hash varchar(128),
  timer_phase public.timer_phase not null default 'paused',
  timer_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_rooms_directory_idx on public.study_rooms(kind, level, subject);

create table public.room_members (
  id serial primary key,
  room_id integer not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null,
  role public.room_role not null default 'member',
  joined_at timestamptz not null default now()
);
create unique index room_members_room_user_unique on public.room_members(room_id, user_id);
create index room_members_user_room_idx on public.room_members(user_id, room_id);

create table public.room_messages (
  id serial primary key,
  room_id integer not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index room_messages_room_date_idx on public.room_messages(room_id, created_at);

create table public.study_sessions (
  id serial primary key,
  user_id uuid not null,
  room_id integer references public.study_rooms(id) on delete set null,
  subject varchar(120),
  duration_minutes integer not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index study_sessions_user_date_idx on public.study_sessions(user_id, started_at);

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title varchar(255) not null,
  source_type varchar(20) not null check (source_type in ('pdf', 'youtube')),
  storage_path varchar(500),
  source_url varchar(500),
  status varchar(20) not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error_message text,
  summary jsonb,
  char_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_documents_user_idx on public.student_documents(user_id, created_at desc);

create table public.student_document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.student_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index student_document_chunks_doc_idx on public.student_document_chunks(document_id, chunk_index);

create table public.quiz_attempts (
  id serial primary key,
  user_id uuid not null,
  level public.school_level,
  subject varchar(120) not null,
  document_id uuid references public.student_documents(id) on delete set null,
  total_questions integer not null,
  correct_answers integer not null,
  curriculum_reference varchar(255),
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_subject_idx on public.quiz_attempts(user_id, subject, created_at);

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  level public.school_level not null,
  subject varchar(120) not null,
  questions jsonb not null,
  total_questions integer not null check (total_questions between 1 and 20),
  correct_answers integer,
  document_id uuid references public.student_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  submitted_at timestamptz,
  check (correct_answers is null or (correct_answers between 0 and total_questions))
);
create index quiz_sessions_user_idx on public.quiz_sessions(user_id, created_at desc);

create table public.leaderboard_snapshots (
  id serial primary key,
  region varchar(120),
  subject varchar(120),
  user_id uuid not null,
  score integer not null,
  period_key varchar(20) not null,
  created_at timestamptz not null default now()
);
create index leaderboard_snapshots_board_idx on public.leaderboard_snapshots(period_key, region, subject, score);
create unique index leaderboard_snapshots_upsert_key on public.leaderboard_snapshots(user_id, region, subject, period_key);

create table public.curriculum_documents (
  id serial primary key,
  title varchar(255) not null,
  level public.school_level not null,
  subject varchar(120) not null,
  source_type varchar(40) not null,
  source_url varchar(500),
  storage_path varchar(500),
  created_at timestamptz not null default now()
);
create index curriculum_documents_level_subject_idx on public.curriculum_documents(level, subject, id);

create table public.curriculum_chunks (
  id serial primary key,
  document_id integer not null references public.curriculum_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index curriculum_chunks_doc_idx on public.curriculum_chunks(document_id, chunk_index);
