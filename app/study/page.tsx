"use client";

import { ChangeEvent, useState } from "react";
import {
  ArrowRight,
  Atom,
  BookOpen,
  BrainCircuit,
  Calculator,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  FileUp,
  FolderOpen,
  Link2,
  Play,
  Sparkles,
  UploadCloud,
  Youtube,
} from "lucide-react";
import { NajahShell } from "@/components/NajahShell";

const recentMaterials = [
  { title: "Limites et continuité", subject: "Mathématiques", age: "il y a 2 jours", icon: Calculator, tone: "text-emerald-800 bg-emerald-50" },
  { title: "Lois de Newton", subject: "Physique", age: "il y a 3 jours", icon: Atom, tone: "text-teal-800 bg-teal-50" },
  { title: "Dérivation et variations", subject: "Analyse", age: "il y a 5 jours", icon: BrainCircuit, tone: "text-amber-800 bg-amber-50" },
];

export default function StudyPage() {
  const [fileName, setFileName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setYoutubeUrl("");
    }
  };

  const analyze = async () => {
    if (!fileName && !youtubeUrl) return;
    setBusy(true);
    await new Promise(resolve => setTimeout(resolve, 900));
    setReady(true);
    setBusy(false);
  };

  return (
    <NajahShell>
      <section dir="ltr" className="mx-auto max-w-[1180px] space-y-7 pb-6">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-4 py-2 text-sm font-bold text-emerald-900 shadow-sm">
            <BookOpen className="size-4 text-emerald-700" />
            <span>Vous consultez maintenant :</span>
            <span className="text-emerald-950">2e année baccalauréat — Sciences mathématiques</span>
            <ChevronDown className="size-4 text-slate-500" />
          </div>
        </div>

        <div className="text-center">
          <p className="section-kicker">Votre espace de révision</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-emerald-950 md:text-5xl">Commencez vos révisions intelligemment</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-500">Importez un cours ou une vidéo, puis transformez-le en résumé, questions et outils de révision.</p>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)_285px]">
          <StudyIllustration />

          <div className="najah-card p-5 md:p-7">
            <div className="rounded-[26px] border-2 border-dashed border-emerald-900/15 bg-white p-5 md:p-7">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-800 ring-8 ring-emerald-50/60">
                <FileUp className="size-8" />
              </div>
              <h2 className="mt-5 text-center text-2xl font-black text-emerald-950">Importer un nouveau support</h2>
              <p className="mt-2 text-center text-sm text-slate-500">PDF, document ou vidéo YouTube</p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <label className="najah-button-gold cursor-pointer px-6">
                  <FileText className="size-5" />
                  Télécharger un PDF
                  <input type="file" accept=".pdf,.doc,.docx" onChange={importFile} className="hidden" />
                </label>
                <button type="button" onClick={() => document.getElementById("youtube-input")?.focus()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-900/25 bg-white px-6 py-3 font-black text-emerald-900 hover:border-emerald-700 hover:bg-emerald-50">
                  <Youtube className="size-5 text-red-600" />
                  Coller un lien YouTube
                </button>
              </div>

              <div className="my-5 flex items-center gap-3 text-xs font-black text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                OU
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[#fbfcfa] px-4 py-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50/40">
                <UploadCloud className="size-8 text-emerald-700 transition group-hover:-translate-y-1" />
                <span className="mt-2 font-black text-emerald-950">Glissez votre fichier ici</span>
                <span className="mt-1 text-sm text-slate-500">ou choisissez-le depuis votre appareil</span>
                <input type="file" accept=".pdf,.doc,.docx" onChange={importFile} className="hidden" />
              </label>
              <p className="mt-4 text-center text-xs font-bold text-slate-400">Formats acceptés : PDF, Word, MP4</p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="absolute left-4 top-3.5 size-5 text-slate-400" />
                  <input id="youtube-input" value={youtubeUrl} onChange={event => { setYoutubeUrl(event.target.value); setFileName(""); }} className="najah-input pl-12" placeholder="Collez ici le lien YouTube du cours" />
                </div>
                <button type="button" onClick={analyze} disabled={busy || (!fileName && !youtubeUrl)} className="najah-button shrink-0 disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? "Analyse…" : "Analyser le support"}
                  <ArrowRight className="size-4" />
                </button>
              </div>

              {fileName && <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="size-4" />{fileName}</p>}
              {ready && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-950">Votre support est prêt : le résumé, l’Assistant IA et le Quiz sont disponibles.</p>}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="najah-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black text-emerald-950"><FolderOpen className="size-5 text-amber-600" />Mes supports récents</h2>
                <button className="text-xs font-black text-emerald-700 hover:text-emerald-950">Voir tout</button>
              </div>
              <div className="mt-4 space-y-2">
                {recentMaterials.map(material => {
                  const Icon = material.icon;
                  return <button key={material.title} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${material.tone}`}><Icon className="size-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-emerald-950">{material.title}</span><span className="mt-1 block text-[11px] text-slate-500">{material.subject} · {material.age}</span></span>
                    <ArrowRight className="size-4 shrink-0 text-slate-400" />
                  </button>;
                })}
              </div>
            </div>

            <div className="najah-card p-5">
              <div className="flex items-center gap-2"><ChartNoAxesCombined className="size-5 text-emerald-700" /><h2 className="text-lg font-black text-emerald-950">Ma progression</h2></div>
              <p className="mt-1 text-sm text-slate-500">Cette semaine</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-900">12</p><p className="mt-1 text-[11px] font-bold text-slate-500">heures de révision</p></div>
                <div className="rounded-2xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-800">78<span className="text-base">%</span></p><p className="mt-1 text-[11px] font-bold text-slate-500">taux de réussite</p></div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[78%] rounded-full bg-emerald-800" /></div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400"><span>Objectif hebdomadaire</span><span>78%</span></div>
            </div>
          </aside>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon={Sparkles} title="Résumé intelligent" text="Les idées essentielles, organisées en quelques instants." />
          <FeatureCard icon={BrainCircuit} title="Assistant IA" text="Posez vos questions et obtenez une explication adaptée à votre niveau." />
          <FeatureCard icon={Play} title="Quiz personnalisé" text="Testez vos acquis avec des questions basées sur votre support." />
        </div>
      </section>
    </NajahShell>
  );
}

function StudyIllustration() {
  return <div className="relative hidden min-h-[420px] overflow-hidden rounded-[32px] bg-gradient-to-b from-[#f2f7f2] to-[#fbf8ed] lg:block">
    <img src="/assets/study-hero-ornament.png" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-bottom opacity-90" />
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
      <img src="/assets/study-hero-illustration.png" alt="Illustration marocaine de livres et de fournitures scolaires" className="relative z-10 h-[430px] w-auto max-w-none object-contain object-bottom drop-shadow-[0_18px_24px_rgba(15,67,55,0.18)]" />
    </div>
    <div className="absolute bottom-5 left-5 z-20 rounded-full bg-white/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-900/70 shadow-sm backdrop-blur-sm">Apprendre · progresser</div>
  </div>;
}

function FeatureCard({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) {
  return <div className="najah-card flex items-start gap-3 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon className="size-5" /></span><div><h3 className="font-black text-emerald-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div></div>;
}
