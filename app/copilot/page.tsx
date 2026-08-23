"use client";

import { useState } from "react";
import { BookMarked, BrainCircuit, ShieldAlert } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { readAssistantResponse } from "@/lib/assistant-stream";
import { labelForLevel, levels, subjects, type Level } from "@/lib/catalog";

type Answer = { answer: string; sources: { title: string; similarity: number }[]; grounded: boolean };

export default function CopilotPage() {
  const { isAuthenticated } = useAuth();
  const [level, setLevel] = useState<Level>("2BAC");
  const [subject, setSubject] = useState(subjects[0]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState("");

  const ask = async () => {
    if (pending || question.trim().length < 8) return;
    setPending(true);
    setError("");
    setResult(null);
    setStreamingText("");
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level, subject, question, locale: "fr" }),
      });
      const data = await readAssistantResponse(res, text => setStreamingText(current => current + text));
      setResult({ answer: data.answer, sources: data.sources ?? [], grounded: data.grounded ?? true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  };

  if (!isAuthenticated) return <NajahShell><div className="najah-card mx-auto max-w-xl p-12 text-center"><BrainCircuit className="mx-auto size-12 text-emerald-700" aria-hidden="true" /><h1 className="mt-5 text-2xl font-black text-emerald-950">Votre assistant vous attend</h1><p className="mt-2 text-slate-500">Connectez-vous pour poser des questions sur votre programme.</p><a href="/auth" className="najah-button mt-6">Se connecter</a></div></NajahShell>;

  return <NajahShell><section aria-labelledby="copilot-title"><p className="section-kicker">Assistant IA</p><h1 id="copilot-title" className="mt-2 text-4xl font-black text-emerald-950">Un assistant qui explique, pas qui invente.</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Posez votre question. Najah.ma recherche d’abord dans les ressources liées au programme marocain avant de répondre.</p></section><section className="mt-8 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><aside className="najah-card p-5"><h2 className="flex items-center gap-2 font-black text-emerald-950"><BookMarked className="size-5 text-amber-700" aria-hidden="true" />Contexte de la question</h2><div className="mt-5 space-y-4"><label className="block space-y-2 text-sm font-bold text-slate-700">Niveau<select value={level} onChange={e => setLevel(e.target.value as Level)} className="najah-input">{levels.map(v => <option key={v} value={v}>{labelForLevel[v]}</option>)}</select></label><label className="block space-y-2 text-sm font-bold text-slate-700">Matière<select value={subject} onChange={e => setSubject(e.target.value)} className="najah-input">{subjects.map(v => <option key={v}>{v}</option>)}</select></label><label className="block space-y-2 text-sm font-bold text-slate-700">Votre question<textarea value={question} onChange={e => setQuestion(e.target.value)} className="najah-input min-h-36" placeholder="Expliquez-moi cette notion avec un exemple…" /></label><button type="button" disabled={question.trim().length < 8 || pending} onClick={ask} className="najah-button w-full disabled:opacity-50">{pending ? "Réponse en cours…" : "Poser ma question"}</button>{error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700" role="alert">{error}</p>}</div></aside><div aria-live="polite">{!result && !pending && !streamingText && <div className="najah-card grid min-h-80 place-items-center border-dashed text-center text-sm text-slate-500"><div><BrainCircuit className="mx-auto size-10 text-emerald-700" aria-hidden="true" /><p className="mt-3">Votre explication apparaîtra ici avec ses sources.</p></div></div>}{pending && <div className="najah-card min-h-80 p-7"><p className="text-xs font-black text-emerald-700">L’assistant écrit en direct…</p>{streamingText ? <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-800">{streamingText}</p> : <p className="mt-5 text-sm text-slate-500">L’assistant lit les ressources…</p>}</div>}{result && <div className="najah-card p-7">{!result.grounded && <div className="mb-5 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900"><ShieldAlert className="size-4 shrink-0" aria-hidden="true" />Les sources disponibles ne suffisent pas pour confirmer entièrement cette réponse.</div>}<p className="whitespace-pre-wrap leading-8 text-slate-800">{result.answer}</p>{result.sources.length > 0 && <div className="mt-6 border-t border-slate-100 pt-4"><p className="text-xs font-black text-slate-500">Sources consultées</p><ul className="mt-2 space-y-1 text-xs text-slate-600">{result.sources.map((source, index) => <li key={index}>{source.title} · {Math.round(source.similarity * 100)}% de pertinence</li>)}</ul></div>}</div>}</div></section></NajahShell>;
}
