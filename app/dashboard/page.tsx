"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, BookOpenCheck, ChartNoAxesCombined, Clock3, FileUp, Flame, LayoutDashboard, LibraryBig, LogOut, MessageCircle, Target, Trophy, Users, Video } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

type Metrics = { studyMinutes: number; quizAccuracy: number; streakDays: number; documentCount: number };

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Mon espace", icon: LayoutDashboard },
  { href: "/archive", label: "Archives", icon: LibraryBig },
  { href: "/study", label: "Ma séance", icon: BookOpen },
  { href: "/copilot", label: "Assistant IA", icon: MessageCircle },
  { href: "/quizzes", label: "Quiz", icon: Target },
  { href: "/rooms", label: "Salles", icon: Users },
];

export default function DashboardPage() {
  const { isAuthenticated, user, loading, signOut } = useAuth();
  const supabase = createBrowserSupabaseClient();
  const [metrics, setMetrics] = useState<Metrics>({ studyMinutes: 0, quizAccuracy: 0, streakDays: 0, documentCount: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [sessionsResult, attemptsResult, documentsResult] = await Promise.all([
        supabase.from("study_sessions").select("duration_minutes,started_at").eq("user_id", user.id),
        supabase.from("quiz_attempts").select("total_questions,correct_answers").eq("user_id", user.id),
        supabase.from("student_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const sessions = sessionsResult.data ?? [];
      const attempts = attemptsResult.data ?? [];
      const total = attempts.reduce((sum, row) => sum + row.total_questions, 0);
      const correct = attempts.reduce((sum, row) => sum + row.correct_answers, 0);
      const days = new Set(sessions.map(row => new Date(row.started_at).toISOString().slice(0, 10)));
      let streak = 0;
      const cursor = new Date();
      cursor.setUTCHours(0, 0, 0, 0);
      while (days.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      setMetrics({
        studyMinutes: sessions.reduce((sum, row) => sum + row.duration_minutes, 0),
        quizAccuracy: total ? Math.round((correct / total) * 100) : 0,
        streakDays: streak,
        documentCount: documentsResult.count ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, [supabase, user]);

  if (loading) return <NajahShell><div className="najah-card mx-auto max-w-xl p-12 text-center"><p className="font-bold text-emerald-900">Chargement de votre espace…</p></div></NajahShell>;
  if (!isAuthenticated) return <NajahShell><div className="najah-card mx-auto max-w-xl p-12 text-center"><ChartNoAxesCombined className="mx-auto size-12 text-emerald-700" /><h1 className="mt-5 text-2xl font-black text-emerald-950">Votre progression est privée</h1><p className="mt-2 text-slate-500">Connectez-vous pour retrouver vos statistiques.</p><Link href="/auth" className="najah-button mt-6">Se connecter</Link></div></NajahShell>;

  const hours = Math.floor(metrics.studyMinutes / 60);
  const minutes = metrics.studyMinutes % 60;
  const studyProgress = Math.min(100, Math.round((metrics.studyMinutes / (8 * 60)) * 100));

  return <NajahShell>
    <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
      <aside className="mb-6 hidden rounded-[28px] bg-emerald-950 p-4 text-white lg:mb-0 lg:flex lg:min-h-[calc(100vh-7rem)] lg:flex-col">
        <Link href="/" className="flex items-center gap-3 rounded-2xl px-3 py-4 text-lg font-black"><span className="grid size-9 place-items-center rounded-xl bg-white/10 text-amber-300"><BookOpenCheck className="size-5" /></span>Najah<span className="text-amber-300">.ma</span></Link>
        <nav className="mt-8 space-y-2" aria-label="Navigation de l’espace">
          {navItems.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${item.href === "/dashboard" ? "bg-white/15 text-white" : "text-emerald-50/75 hover:bg-white/10 hover:text-white"}`}><Icon className="size-5" />{item.label}</Link>; })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4"><Link href="/profile" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-emerald-50/75 hover:bg-white/10 hover:text-white"><Users className="size-5" />Mon profil</Link><button onClick={() => void signOut()} className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-emerald-50/75 hover:bg-white/10 hover:text-white"><LogOut className="size-5" />Se déconnecter</button></div>
      </aside>

      <main className="min-w-0">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div><p className="section-kicker">Mon espace</p><h1 className="mt-2 text-4xl font-black tracking-tight text-emerald-950 md:text-5xl">Bonjour, continuons à progresser.</h1><p className="mt-3 text-slate-600">Chaque session compte. Voici votre rythme actuel.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/study" className="najah-button-gold"><Clock3 className="size-4" />Ma séance</Link><Link href="/profile" className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-900 hover:border-emerald-400">Mon profil</Link></div>
        </header>

        <section className="najah-card mt-8 overflow-hidden border-emerald-100 bg-gradient-to-r from-white to-emerald-50/60 p-5 md:p-6" aria-labelledby="import-title">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div><p className="section-kicker">Nouveau support</p><h2 id="import-title" className="mt-1 text-2xl font-black text-emerald-950">Importer votre contenu</h2><p className="mt-1 text-sm text-slate-600">Transformez un cours en résumé, assistant et quiz personnalisés.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:min-w-[610px]">
            <Link href="/study" className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-emerald-200 bg-white p-4 transition hover:border-emerald-500 hover:bg-emerald-50"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><FileUp className="size-6" /></span><span className="min-w-0"><strong className="block text-sm font-black text-emerald-950">Importer un PDF</strong><span className="mt-1 block text-xs text-slate-500">Fichier PDF jusqu’à 20 Mo</span></span><ArrowRight className="ml-auto size-5 text-emerald-700 transition group-hover:translate-x-1" /></Link>
            <Link href="/study" className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-amber-200 bg-white p-4 transition hover:border-amber-500 hover:bg-amber-50"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Video className="size-6" /></span><span className="min-w-0"><strong className="block text-sm font-black text-emerald-950">Ajouter un lien YouTube</strong><span className="mt-1 block text-xs text-slate-500">Vidéo sous-titrée recommandée</span></span><ArrowRight className="ml-auto size-5 text-amber-700 transition group-hover:translate-x-1" /></Link>
          </div></div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Statistiques personnelles">
          <MetricCard label="Temps de révision" value={`${hours}h ${minutes}min`} icon={Clock3} tone="green" />
          <MetricCard label="Série actuelle" value={`${metrics.streakDays} jour(s)`} icon={Flame} tone="gold" />
          <MetricCard label="Précision des quiz" value={`${metrics.quizAccuracy}%`} icon={Target} tone="green" />
          <MetricCard label="Cours importés" value={`${metrics.documentCount}`} icon={BookOpen} tone="gold" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <article className="najah-card p-6 md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Votre rythme</p><h2 className="mt-1 text-2xl font-black text-emerald-950">Progression de la semaine</h2></div><span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">En direct</span></div><div className="mt-7 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/30 p-5"><div className="flex h-36 items-end justify-between gap-2 border-b border-emerald-100 px-2 pb-0">{[0, 0, 0, 0, 0, 0, 0].map((height, index) => <div key={index} className="flex h-full flex-1 items-end justify-center"><div className="w-full max-w-9 rounded-t-lg bg-emerald-200/60" style={{ height: `${Math.max(height, 8)}%` }} /></div>)}</div><div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold text-slate-400"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div><p className="mt-5 text-center text-sm font-bold text-slate-600">Commencez une séance pour voir votre progression ici.</p></div></article>
          <article className="najah-card p-6 md:p-7"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Trophy className="size-5" /></span><div><p className="section-kicker">À atteindre</p><h2 className="mt-1 text-2xl font-black text-emerald-950">Vos objectifs</h2></div></div><ProgressRow label="Importer un premier cours" value={metrics.documentCount ? 100 : 0} /><ProgressRow label="Réviser 8 heures" value={studyProgress} /><ProgressRow label="Réussir un quiz" value={metrics.quizAccuracy ? 100 : 0} /><Link href="/study" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-800 hover:text-emerald-600">Commencer maintenant <ArrowRight className="size-4" /></Link></article>
        </section>

        <section className="mt-6 pb-8"><div className="flex items-center justify-between"><div><p className="section-kicker">Accès rapide</p><h2 className="mt-1 text-2xl font-black text-emerald-950">Reprendre votre parcours</h2></div><Link href="/study" className="hidden items-center gap-2 text-sm font-black text-emerald-800 sm:flex">Voir Ma séance <ArrowRight className="size-4" /></Link></div><div className="mt-4 grid gap-4 md:grid-cols-3"><QuickCard href="/study" icon={BookOpen} title="Ma séance" text="Importer et analyser un nouveau support" tone="green" /><QuickCard href="/archive" icon={LibraryBig} title="Archives des examens" text="Trouver un sujet adapté à votre niveau" tone="gold" /><QuickCard href="/quizzes" icon={Target} title="Quiz rapide" text="Tester vos connaissances en quelques minutes" tone="green" /></div></section>
      </main>
    </div>
  </NajahShell>;
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: "green" | "gold" }) { return <div className="najah-card p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone === "gold" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><Icon className="size-5" /></span><p className="mt-4 text-2xl font-black text-emerald-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>; }

function ProgressRow({ label, value }: { label: string; value: number }) { return <div className="mt-6"><div className="flex justify-between gap-3 text-sm font-bold text-slate-700"><span>{label}</span><span className="text-emerald-700">{value}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${value}%` }} /></div></div>; }

function QuickCard({ href, icon: Icon, title, text, tone }: { href: string; icon: LucideIcon; title: string; text: string; tone: "green" | "gold" }) { return <Link href={href} className="group najah-card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tone === "gold" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><Icon className="size-6" /></span><span className="min-w-0"><strong className="block font-black text-emerald-950">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span></span><ArrowRight className="ml-auto size-5 shrink-0 text-emerald-700 transition group-hover:translate-x-1" /></Link>; }
