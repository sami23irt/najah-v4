import { createServiceClient } from "./supabase-server";

/** ISO week key, e.g. "2026-W33" — matches leaderboard_snapshots.period_key */
function currentPeriodKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Simple, transparent scoring: study minutes count a little, correct quiz
// answers count more (rewards actual mastery, not just clock time), matching
// the doc's "نسبة الإجابات الصحيحة" + "ساعات الدراسة" dashboard metrics.
const MINUTES_WEIGHT = 1;
const CORRECT_ANSWER_WEIGHT = 8;

/**
 * Recomputes one student's score for the current week and upserts it into
 * leaderboard_snapshots. This is the function that was missing entirely in
 * v1 — the table existed and was read from, but nothing ever wrote to it.
 *
 * Call this after recordStudySession / recordQuizAttempt, and also from a
 * scheduled Supabase Edge Function (pg_cron, see 0002_leaderboard_cron.sql)
 * so scores stay fresh even for students who haven't acted today but whose
 * region/subject aggregates should still reflect recent activity.
 */
export async function refreshLeaderboardForUser(userId: string) {
  const supabase = createServiceClient();
  const periodKey = currentPeriodKey();
  const weekStart = new Date();
  const day = weekStart.getUTCDay() || 7; // ISO Monday = 1
  weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
  weekStart.setUTCHours(0, 0, 0, 0);

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("region")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: sessions } = await supabase
    .from("study_sessions")
    .select("subject, duration_minutes")
    .eq("user_id", userId)
    .gte("started_at", weekStart.toISOString());

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("subject, correct_answers")
    .eq("user_id", userId)
    .gte("created_at", weekStart.toISOString());

  // Aggregate per subject so the "لوحة الشرف حسب ... المواد" breakdown in the
  // doc actually works, not just one global score.
  const bySubject = new Map<string, number>();
  for (const s of sessions ?? []) {
    const key = s.subject ?? "عام";
    bySubject.set(key, (bySubject.get(key) ?? 0) + s.duration_minutes * MINUTES_WEIGHT);
  }
  for (const a of attempts ?? []) {
    const key = a.subject ?? "عام";
    bySubject.set(key, (bySubject.get(key) ?? 0) + a.correct_answers * CORRECT_ANSWER_WEIGHT);
  }

  const rows = Array.from(bySubject.entries()).map(([subject, score]) => ({
    user_id: userId,
    region: profile?.region ?? "غير محددة",
    subject,
    score: Math.round(score),
    period_key: periodKey,
  }));

  await supabase
    .from("leaderboard_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("period_key", periodKey);

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("leaderboard_snapshots")
    .upsert(rows, { onConflict: "user_id,region,subject,period_key" });

  if (error) throw new Error(`Leaderboard refresh failed: ${error.message}`);
}
