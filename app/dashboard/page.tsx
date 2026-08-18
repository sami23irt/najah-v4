"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { ChartNoAxesCombined, Clock3, Flame, Target, Trophy } from "lucide-react";

type Metrics = { studyMinutes: number; quizAccuracy: number; streakDays: number };
type LeaderboardEntry = { score: number; pseudonym: string | null; show_pseudonym: boolean };

export default function DashboardPage() {
  const { isAuthenticated, user, startLogin } = useAuth();
  const supabase = createBrowserSupabaseClient();
  const [metrics, setMetrics] = useState<Metrics>({ studyMinutes: 0, quizAccuracy: 0, streakDays: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [sessionsResult, attemptsResult] = await Promise.all([
        supabase
          .from("study_sessions")
          .select("duration_minutes,started_at,completed_at")
          .eq("user_id", user.id),
        supabase
          .from("quiz_attempts")
          .select("total_questions,correct_answers")
          .eq("user_id", user.id),
      ]);

      const sessions = sessionsResult.data ?? [];
      const attempts = attemptsResult.data ?? [];
      const studyMinutes = sessions.reduce((sum, row) => sum + row.duration_minutes, 0);
      const total = attempts.reduce((sum, row) => sum + row.total_questions, 0);
      const correct = attempts.reduce((sum, row) => sum + row.correct_answers, 0);

      const studyDays = new Set(
        sessions.map(row => new Date(row.started_at).toISOString().slice(0, 10))
      );
      let streakDays = 0;
      const cursor = new Date();
      cursor.setUTCHours(0, 0, 0, 0);
      while (studyDays.has(cursor.toISOString().slice(0, 10))) {
        streakDays++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }

      setMetrics({
        studyMinutes,
        quizAccuracy: total ? Math.round((correct / total) * 100) : 0,
        streakDays,
      });
    })();

    const periodKey = (() => {
      const d = new Date();
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    })();

    supabase
      .rpc("get_public_leaderboard", { p_period_key: periodKey, p_limit: 5 })
      .then(({ data }) => {
        setLeaderboard(
          (data ?? []).map((row: { score: number; pseudonym: string | null; show_pseudonym: boolean }) => ({
            score: row.score,
            pseudonym: row.pseudonym,
            show_pseudonym: row.show_pseudonym,
          }))
        );
      });

  }, [user]);

  if (!isAuthenticated) {
    return (
      <NajahShell>
        <div className="rounded-3xl bg-white p-10 text-center">
          <ChartNoAxesCombined className="mx-auto size-10 text-emerald-700" />
          <h1 className="mt-4 text-2xl font-black text-emerald-950">لوحة التقدم خاصة بحسابك</h1>
          <button onClick={() => startLogin()} className="mt-5 rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white">دخول التلميذ</button>
        </div>
      </NajahShell>
    );
  }

  const hours = Math.floor(metrics.studyMinutes / 60);
  const minutes = metrics.studyMinutes % 60;

  return (
    <NajahShell>
      <section>
        <p className="section-kicker">لوحتي</p>
        <h1 className="mt-2 text-4xl font-black text-emerald-950">أهلاً، لنرى تقدّمك.</h1>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard label="ساعات الدراسة" value={`${hours}س ${minutes}د`} icon={Clock3} />
        <MetricCard label="سلسلة الاستمرارية" value={`${metrics.streakDays} أيام`} icon={Flame} />
        <MetricCard label="دقّة QCM" value={`${metrics.quizAccuracy}%`} icon={Target} />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_.85fr]">
        <article className="rounded-3xl bg-emerald-950 p-7 text-white">
          <p className="section-kicker text-amber-200">الخطوة التالية</p>
          <h2 className="mt-2 text-2xl font-black">اختر امتحاناً أو انضم لجلسة تركيز.</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/archive" className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-emerald-950">الأرشيف</Link>
            <Link href="/rooms" className="rounded-xl border border-white/20 px-4 py-2 font-bold text-white">غرف المراجعة</Link>
          </div>
        </article>
        <article className="rounded-3xl border border-emerald-950/10 bg-white p-6">
          <h2 className="flex items-center gap-2 text-xl font-black text-emerald-950"><Trophy className="size-5 text-amber-600" />لوحة الشرف</h2>
          {leaderboard.length ? (
            <ol className="mt-5 space-y-3">
              {leaderboard.map((entry, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-[#f7f6f0] px-3 py-2">
                  <span className="font-bold text-emerald-950">{i + 1}. {entry.show_pseudonym ? entry.pseudonym || "تلميذ" : "تلميذ"}</span>
                  <span className="text-sm font-black text-amber-700">{entry.score} نقطة</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm leading-7 text-slate-600">ستظهر لوحة الشرف عند توفر نقاط ناتجة عن نشاط فعلي.</p>
          )}
        </article>
      </section>
    </NajahShell>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock3 }) {
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white p-5">
      <Icon className="size-5 text-emerald-700" />
      <p className="mt-3 text-2xl font-black text-emerald-950">{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}
