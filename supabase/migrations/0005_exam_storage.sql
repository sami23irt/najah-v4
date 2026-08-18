-- Exam PDFs are private objects. The application server issues short-lived
-- signed URLs only after verifying that the corresponding exam is published.
insert into storage.buckets (id, name, public)
values ('exams', 'exams', false)
on conflict (id) do update set public = false;


-- Required for Supabase Postgres Changes subscriptions used by room chat/timer.
do $$
begin
  alter publication supabase_realtime add table public.room_messages;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.study_rooms;
exception
  when duplicate_object then null;
end;
$$;
