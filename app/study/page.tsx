"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, Bot, CheckCircle2, FileText, FileUp, Link2, Loader2, LogIn, MessageCircle, Send, ShieldAlert, Sparkles, WandSparkles, XCircle } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";
import { readAssistantResponse } from "@/lib/assistant-stream";
import { useAuth } from "@/lib/useAuth";

type StudySummary = { mainIdea: string; keyPoints: string[]; workedExample?: string };
type ChatMessage = { from: "ai" | "me"; text: string };
type QuizQuestion = { question: string; options: string[]; explanation?: string };
type QuizReviewItem = { question: string; selectedIndex: number; correctIndex: number; explanation: string };

export default function StudyPage() {
  const { isAuthenticated, loading } = useAuth();

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [summary, setSummary] = useState<StudySummary | null>(null);

  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState("");

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState("");

  const [quizOpen, setQuizOpen] = useState(false);

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setYoutubeUrl("");
    }
  };

  const analyze = async () => {
    if (!selectedFile && !youtubeUrl) return;
    setBusy(true);
    setImportError("");
    try {
      let res: Response;
      if (selectedFile) {
        const form = new FormData();
        form.append("file", selectedFile);
        res = await fetch("/api/study/upload", { method: "POST", body: form });
      } else {
        res = await fetch("/api/study/youtube", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: youtubeUrl }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Impossible d’analyser le fichier.");

      setDocumentId(data.documentId);
      setSourceTitle(data.title);
      setSummary(data.summary);
      setMessages([{ from: "ai", text: "Bonjour ! J'ai analysé votre support. Posez-moi une question sur ce cours et je vous répondrai à partir de son contenu." }]);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Impossible d’analyser le fichier.");
    } finally {
      setBusy(false);
    }
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !documentId || asking) return;
    const asked = question.trim();
    setQuestion("");
    setStreamingAnswer("");
    setMessages(current => [...current, { from: "me", text: asked }]);
    setAsking(true);
    try {
      const res = await fetch("/api/study/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId, question: asked, locale: "fr" }),
      });
      const data = await readAssistantResponse(res, text => setStreamingAnswer(current => current + text));
      setMessages(current => [...current, { from: "ai", text: data.answer }]);
      setStreamingAnswer("");
    } catch (cause) {
      setStreamingAnswer("");
      setMessages(current => [...current, { from: "ai", text: cause instanceof Error ? cause.message : "Une erreur est survenue." }]);
    } finally {
      setAsking(false);
    }
  };

  if (loading) return <NajahShell><div className="h-[60vh] animate-pulse rounded-3xl bg-slate-100" /></NajahShell>;

  if (!isAuthenticated) {
    return (
      <NajahShell>
        <div className="najah-card mx-auto max-w-xl p-12 text-center">
          <LogIn className="mx-auto size-12 text-emerald-700" />
          <h1 className="mt-5 text-2xl font-black text-emerald-950">Votre séance de révision vous attend</h1>
          <p className="mt-2 text-slate-500">Connectez-vous pour importer un support et l'analyser avec l'IA.</p>
          <a href="/auth" className="najah-button mt-6">Se connecter</a>
        </div>
      </NajahShell>
    );
  }

  return (
    <NajahShell>
      {!documentId ? (
        <section className="mx-auto max-w-5xl">
          <div className="mb-8">
            <p className="section-kicker">Ma séance de révision</p>
            <h1 className="mt-2 text-4xl font-black text-emerald-950 md:text-5xl">Commencez par une matière.</h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">Importez un PDF ou collez une vidéo YouTube sous-titrée. Najah.ma analyse votre support et en tire un résumé, un assistant et un quiz.</p>
          </div>
          <div className="najah-card overflow-hidden md:grid md:grid-cols-[1fr_.65fr]">
            <div className="p-7 md:p-10">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Sparkles /></span>
                <div>
                  <h2 className="text-2xl font-black text-emerald-950">Importer un nouveau support</h2>
                  <p className="text-sm text-slate-500">PDF ou vidéo YouTube sous-titrée</p>
                </div>
              </div>
              <div className="mt-8 rounded-[26px] border-2 border-dashed border-emerald-200 bg-emerald-50/45 p-8 text-center">
                <FileUp className="mx-auto size-12 text-emerald-700" />
                <p className="mt-4 text-lg font-black text-emerald-950">Déposez votre PDF ici</p>
                <p className="mt-2 text-sm text-slate-500">ou choisissez un fichier depuis votre appareil</p>
                <label className="najah-button mt-5 cursor-pointer">
                  <FileText className="size-4" />Choisir un PDF
                  <input type="file" accept="application/pdf" onChange={importFile} className="hidden" aria-label="Choisir un fichier PDF à analyser" />
                </label>
                {fileName && <p className="mt-4 rounded-xl bg-white p-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="mr-1 inline size-4" />{fileName}</p>}
              </div>
              <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-400"><span className="h-px flex-1 bg-slate-200" />OU<span className="h-px flex-1 bg-slate-200" /></div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-4 top-3.5 size-5 text-slate-400" />
                  <input id="youtube-url" type="url" value={youtubeUrl} onChange={e => { setYoutubeUrl(e.target.value); setSelectedFile(null); setFileName(""); }} className="najah-input pl-12" placeholder="Collez un lien YouTube" aria-label="Lien de la vidéo YouTube" />
                </div>
                <button onClick={analyze} disabled={busy || (!selectedFile && !youtubeUrl)} className="najah-button shrink-0 disabled:opacity-40">
                  {busy ? <><Loader2 className="size-4 animate-spin" />Analyse…</> : "Analyser"}
                </button>
              </div>
              {importError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"><XCircle className="mr-1 inline size-4" />{importError}</p>}
            </div>
            <aside className="moroccan-grid relative bg-emerald-950 p-7 text-white md:p-9">
              <div className="relative mb-7 h-48 overflow-hidden rounded-[26px] bg-gradient-to-b from-[#f2f7f2] to-[#fbf8ed]">
                <Image src="/assets/study-hero-ornament.webp" alt="" aria-hidden="true" fill sizes="(max-width: 768px) 100vw, 40vw" className="pointer-events-none object-cover object-bottom opacity-90" />
                <Image src="/assets/study-hero-illustration.webp" alt="Illustration marocaine de livres et de fournitures scolaires" width={1664} height={2080} sizes="(max-width: 768px) 100vw, 40vw" className="absolute inset-x-0 bottom-0 mx-auto h-56 w-auto max-w-none object-contain object-bottom drop-shadow-[0_18px_24px_rgba(15,67,55,0.18)]" />
              </div>
              <WandSparkles className="size-10 text-amber-300" />
              <h3 className="mt-6 text-2xl font-black">Votre support devient un plan de révision.</h3>
              <div className="mt-8 space-y-5 text-sm text-emerald-50/75">
                <p><span className="mr-3 inline-grid size-7 place-items-center rounded-full bg-white/10 font-black text-amber-200">1</span>Un résumé structuré et lisible</p>
                <p><span className="mr-3 inline-grid size-7 place-items-center rounded-full bg-white/10 font-black text-amber-200">2</span>Un assistant qui connaît le contexte</p>
                <p><span className="mr-3 inline-grid size-7 place-items-center rounded-full bg-white/10 font-black text-amber-200">3</span>Un quiz pour vérifier vos acquis</p>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <Workspace
          sourceTitle={sourceTitle}
          summary={summary}
          messages={messages}
          question={question}
          setQuestion={setQuestion}
          ask={ask}
          asking={asking}
          streamingAnswer={streamingAnswer}
          openQuiz={() => setQuizOpen(true)}
        />
      )}
      {quizOpen && documentId && <QuizModal documentId={documentId} close={() => setQuizOpen(false)} />}
    </NajahShell>
  );
}

function Workspace({ sourceTitle, summary, messages, question, setQuestion, ask, asking, streamingAnswer, openQuiz }: {
  sourceTitle: string;
  summary: StudySummary | null;
  messages: ChatMessage[];
  question: string;
  setQuestion: (v: string) => void;
  ask: (e: FormEvent) => void;
  asking: boolean;
  streamingAnswer: string;
  openQuiz: () => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Support analysé</p>
          <h1 className="mt-2 text-4xl font-black text-emerald-950">{sourceTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">Analyse terminée</p>
        </div>
        <button onClick={openQuiz} className="najah-button-gold"><WandSparkles className="size-5" />Créer un Quiz</button>
      </div>
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_.9fr]">
        <article className="najah-card p-6 md:p-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Résumé intelligent</p>
              <h2 className="mt-1 text-2xl font-black text-emerald-950">Ce qu'il faut retenir</h2>
            </div>
            <BookOpen className="size-7 text-emerald-700" />
          </div>
          {summary ? (
            <div className="mt-7 space-y-7 text-slate-700">
              <div>
                <h3 className="font-black text-emerald-900">L'idée essentielle</h3>
                <p className="mt-2 leading-7">{summary.mainIdea}</p>
              </div>
              <div>
                <h3 className="font-black text-emerald-900">À retenir</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {summary.keyPoints.map((point, i) => (
                    <div key={i} className={`rounded-2xl p-4 text-sm font-bold ${i % 2 === 0 ? "bg-emerald-50" : "bg-amber-50 text-amber-950"}`}>{point}</div>
                  ))}
                </div>
              </div>
              {summary.workedExample && (
                <div>
                  <h3 className="font-black text-emerald-900">Exemple</h3>
                  <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-emerald-100 bg-[#fbfcfa] p-5 font-mono text-sm">{summary.workedExample}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-7 text-sm text-slate-500">Résumé indisponible pour ce support.</p>
          )}
        </article>
        <aside className="najah-card flex min-h-[480px] flex-col p-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="grid size-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Bot /></span>
            <div>
              <h2 className="font-black text-emerald-950">Assistant IA</h2>
              <p className="text-xs text-slate-500">Contexte : ce support</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-auto py-4">
            {messages.map((message, index) => (
              <div key={index} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl p-3 text-sm leading-6 ${message.from === "me" ? "ml-auto bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}>{message.text}</div>
            ))}
            {asking && <div className="max-w-[92%] rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">{streamingAnswer ? <span className="whitespace-pre-wrap">{streamingAnswer}</span> : <><Loader2 className="inline size-4 animate-spin" /> Réflexion…</>}</div>}
          </div>
          <form onSubmit={ask} className="mt-auto">
            <div className="relative">
              <MessageCircle className="absolute left-3 top-3 size-4 text-slate-400" />
              <input id="study-question" value={question} onChange={e => setQuestion(e.target.value)} disabled={asking} className="najah-input pl-9 pr-12 text-sm" placeholder="Posez une question sur ce cours…" aria-label="Question à poser sur le cours" />
              <button type="submit" disabled={asking || !question.trim()} aria-label="Envoyer la question" className="absolute right-2 top-2 rounded-xl bg-emerald-900 p-2 text-white disabled:opacity-40"><Send className="size-4" aria-hidden="true" /></button>
            </div>
          </form>
        </aside>
      </div>
    </section>
  );
}

function QuizModal({ documentId, close }: { documentId: string; close: () => void }) {
  const [phase, setPhase] = useState<"loading" | "answering" | "submitting" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ correctAnswers: number; totalQuestions: number; review: QuizReviewItem[] } | null>(null);
  const generationStarted = useRef(false);

  useEffect(() => {
    if (generationStarted.current) return;
    generationStarted.current = true;
    const controller = new AbortController();
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/study/quiz", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId, count: 6 }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Impossible de créer le quiz.");
        if (!active) return;
        setSessionId(data.sessionId);
        setQuestions(data.questions);
        setAnswers(Array(data.questions.length).fill(-1));
        setPhase("answering");
      } catch (e) {
        if (!active || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Impossible de créer le quiz.");
        setPhase("error");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [documentId]);

  const submit = async () => {
    if (!sessionId) return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/quizzes/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Impossible d’envoyer le quiz.");
      setResult(data);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’envoyer le quiz.");
      setPhase("error");
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-emerald-950/45 p-5 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[30px] bg-white p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="section-kicker">Quiz généré à partir du support</p>
            <h2 className="mt-1 text-3xl font-black text-emerald-950">Vérifiez vos acquis</h2>
          </div>
          <button onClick={close} className="rounded-xl px-3 py-2 text-slate-400 hover:bg-slate-100">Fermer</button>
        </div>

        {phase === "loading" && <div className="mt-10 grid place-items-center py-12 text-emerald-800"><Loader2 className="size-8 animate-spin" /><p className="mt-3 text-sm font-bold">Génération du quiz à partir de votre support…</p></div>}

        {phase === "error" && (
          <div className="mt-8 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700"><ShieldAlert className="mr-1 inline size-4" />{error}</div>
        )}

        {(phase === "answering" || phase === "submitting") && (
          <div className="mt-7 space-y-5">
            {questions.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-100 p-5">
                <p className="font-black text-emerald-950">{index + 1}. {item.question}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {item.options.map((option, optionIndex) => (
                    <button
                      key={option}
                      disabled={phase === "submitting"}
                      onClick={() => setAnswers(answers.map((value, i) => (i === index ? optionIndex : value)))}
                      className={`rounded-xl border p-3 text-left text-sm font-bold ${answers[index] === optionIndex ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 hover:border-emerald-300"}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button disabled={answers.some(value => value < 0) || phase === "submitting"} onClick={submit} className="najah-button w-full disabled:opacity-40">
              {phase === "submitting" ? <><Loader2 className="size-4 animate-spin" />Envoi…</> : "Voir mon résultat"}
            </button>
          </div>
        )}

        {phase === "done" && result && (
          <div className="mt-8">
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-14 text-emerald-700" />
              <p className="mt-4 text-5xl font-black text-emerald-950">{result.correctAnswers}/{result.totalQuestions}</p>
              <p className="mt-2 text-slate-600">Revoyez les explications ci-dessous pour les notions à consolider.</p>
            </div>
            <div className="mt-7 space-y-4 text-left">
              {result.review.map((item, index) => (
                <div key={index} className={`rounded-2xl border p-4 text-sm ${item.selectedIndex === item.correctIndex ? "border-emerald-100 bg-emerald-50/60" : "border-red-100 bg-red-50/60"}`}>
                  <p className="font-black text-emerald-950">{index + 1}. {item.question}</p>
                  <p className="mt-2 leading-6 text-slate-700">{item.explanation}</p>
                </div>
              ))}
            </div>
            <button onClick={close} className="najah-button mt-6 w-full">Retour au support</button>
          </div>
        )}
      </div>
    </div>
  );
}
