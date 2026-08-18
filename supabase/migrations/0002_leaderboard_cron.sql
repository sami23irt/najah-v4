-- Belt-and-suspenders refresh: recompute every active student's weekly score
-- every night, in case the app-side refreshLeaderboardForUser() call was
-- ever skipped (e.g. a client crashed mid-request after inserting the
-- session but before the leaderboard call landed).
create extension if not exists pg_cron;

create or replace function refresh_all_leaderboards() returns void
language plpgsql security definer set search_path = public as $$
declare
  week_start timestamptz := date_trunc('week', now());
  v_period_key text := to_char(now(), 'IYYY-"W"IW');
begin
  delete from leaderboard_snapshots
  where period_key = v_period_key;

  insert into leaderboard_snapshots (user_id, region, subject, score, period_key)
  select
    combined.user_id,
    coalesce(sp.region, 'غير محددة'),
    combined.subject,
    round(sum(combined.score))::int as score,
    v_period_key
  from (
    select user_id, coalesce(subject, 'عام') as subject, duration_minutes * 1 as score
    from study_sessions
    where started_at >= week_start
    union all
    select user_id, subject, correct_answers * 8 as score
    from quiz_attempts
    where created_at >= week_start
  ) combined
  left join student_profiles sp on sp.user_id = combined.user_id
  group by combined.user_id, coalesce(sp.region, 'غير محددة'), combined.subject
  on conflict (user_id, region, subject, period_key)
  do update set score = excluded.score, created_at = now();
end;
$$;

select cron.schedule('refresh-leaderboard-nightly', '0 2 * * *', 'select refresh_all_leaderboards();');
