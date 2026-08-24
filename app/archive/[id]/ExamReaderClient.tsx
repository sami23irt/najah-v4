"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NajahShell } from "@/components/NajahShell";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { ArrowRight, FileWarning, Maximize2, ShieldCheck } from "lucide-react";

type ExamFile = { kind: "subject" | "correction" | "resource"; storage_path: string };
type ExamDetail = { id: number; title: string; curriculum_reference: string | null; files: ExamFile[] };

export default function ExamReaderPage({ id, initialExam }: { id: string; initialExam?: ExamDetail }) {
  const [exam, setExam] = useState<ExamDetail | null | undefined>(initialExam);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    (async () => {
      const { data: examRow } = await supabase.from("exams").select("id,title,curriculum_reference").eq("id", id).eq("is_published", true).maybeSingle();
      if (!examRow) return setExam(null);
      const { data: files } = await supabase.from("exam_files").select("kind,storage_path").eq("exam_id", id);
      setExam({ ...examRow, files: files ?? [] });
    })();
  }, [id]);

  if (exam === undefined) return <NajahShell><div className="h-[70vh] animate-pulse rounded-3xl bg-slate-100" /></NajahShell>;
  if (!exam) {
    return (
      <NajahShell>
        <div className="rounded-3xl bg-white p-10 text-center">
          <FileWarning className="mx-auto size-9 text-amber-700" />
          <h1 className="mt-4 text-2xl font-black text-emerald-950">Cet examen n’est pas disponible</h1>
          <Link href="/archive" className="mt-5 inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2 font-bold">
            <ArrowRight className="size-4" />Retour aux archives
          </Link>
        </div>
      </NajahShell>
    );
  }

  const subject = exam.files.find(f => f.kind === "subject");
  const correction = exam.files.find(f => f.kind === "correction");

  return (
    <NajahShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/archive" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800"><ArrowRight className="size-4" />Retour aux archives</Link>
          <h1 className="mt-2 text-3xl font-black text-emerald-950">{exam.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{exam.curriculum_reference || "Aucune référence pédagogique n’est encore disponible."}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">
          <ShieldCheck className="size-4" />Document publié dans les archives
        </span>
      </div>
      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <PdfPanel title="Sujet de l’examen" kind="subject" examId={exam.id} storagePath={subject?.storage_path} />
        <PdfPanel title="Corrigé / éléments de réponse" kind="correction" examId={exam.id} storagePath={correction?.storage_path} />
      </section>
    </NajahShell>
  );
}

function PdfPanel({ title, kind, examId, storagePath }: { title: string; kind: "subject" | "correction"; examId: number; storagePath?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) return;
    // The server verifies that the exam is published before issuing a
    // short-lived signed URL. The browser never needs Storage RLS privileges.
    fetch(`/api/archive/files?examId=${encodeURIComponent(String(examId))}&kind=${kind}`)
      .then(async response => (response.ok ? response.json() : null))
      .then(data => setUrl(data?.url ?? null))
      .catch(() => setUrl(null));
  }, [storagePath, examId, kind]);

  return (
    <article className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-950/10 px-5 py-4">
        <h2 className="font-black text-emerald-950">{title}</h2>
        {url && <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-bold text-emerald-800"><Maximize2 className="size-4" />Ouvrir</a>}
      </div>
      {url ? (
        <iframe className="h-[70vh] w-full bg-slate-50" title={title} src={`${url}#view=FitH`} />
      ) : (
        <div className="grid min-h-80 place-items-center px-6 text-center">
          <div>
            <FileWarning className="mx-auto size-8 text-amber-700" />
            <p className="mt-3 font-bold text-emerald-950">Ce fichier n’a pas encore été importé.</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">Aucun corrigé de remplacement ni contenu non vérifié ne sera affiché ici.</p>
          </div>
        </div>
      )}
    </article>
  );
}
