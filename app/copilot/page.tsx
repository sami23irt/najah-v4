"use client";

import { useState } from "react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { labelForLevel, levels, subjects, type Level } from "@/lib/catalog";
import { BrainCircuit, BookMarked, ShieldAlert } from "lucide-react";

type Answer = { answer: string; sources: { title: string; similarity: number }[]; grounded: boolean };

export default function CopilotPage() {
  const { isAuthenticated, startLogin } = useAuth();
  const [level, setLevel] = useState<Level>("2BAC");
  const [subject, setSubject] = useState(subjects[0]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <NajahShell>
        <div className="rounded-3xl bg-white p-10 text-center">
          <BrainCircuit className="mx-auto size-10 text-emerald-700" />
          <h1 className="mt-4 text-2xl font-black text-emerald-950">المساعد الذكي يحتاج حساباً</h1>
          <button onClick={() => startLogin()} className="mt-5 rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white">دخول التلميذ</button>
        </div>
      </NajahShell>
    );
  }

  const ask = async () => {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level, subject, question, locale: "ar" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "تعذر توليد إجابة.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع.");
    } finally {
      setPending(false);
    }
  };

  return (
    <NajahShell>
      <section className="max-w-3xl">
        <p className="section-kicker">Najah Copilot</p>
        <h1 className="mt-2 text-4xl font-black text-emerald-950">مساعد يشرح، ولا يدّعي مرجعاً غير متاح.</h1>
        <p className="mt-3 leading-8 text-slate-600">
          يبحث المساعد في قاعدة المعرفة الرسمية المرتبطة بالمقرر المغربي قبل الإجابة. إذا لم يجد مقتطفاً موثوقاً كافياً، يخبرك بذلك بدل تخمين إجابة.
        </p>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <aside className="rounded-3xl border border-emerald-950/10 bg-white p-5">
          <h2 className="flex items-center gap-2 font-black text-emerald-950"><BookMarked className="size-5 text-amber-700" />السياق</h2>
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">المستوى</label>
                <select value={level} onChange={e => setLevel(e.target.value as Level)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
                  {levels.map(v => <option key={v} value={v}>{labelForLevel[v]}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">المادة</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
                  {subjects.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">سؤالك</label>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} className="min-h-36 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="اشرح لي طريقة حل هذا النوع من التمارين…" />
            </div>
            <button disabled={question.trim().length < 8 || pending} onClick={ask} className="w-full rounded-xl bg-emerald-900 py-2.5 font-bold text-white disabled:opacity-50">
              {pending ? "جارٍ البحث والتوليد…" : "اسأل المساعد"}
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </aside>

        <div>
          {!result && !pending && <div className="grid h-full min-h-64 place-items-center rounded-3xl border border-dashed border-emerald-950/20 text-sm text-slate-500">ستظهر الإجابة هنا مع مصادرها.</div>}
          {result && (
            <div className="rounded-3xl border border-emerald-950/10 bg-white p-6">
              {!result.grounded && (
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  لا يوجد مقتطف كافٍ من قاعدة المعرفة لتأكيد هذه الإجابة بثقة.
                </div>
              )}
              <p className="whitespace-pre-wrap leading-7 text-slate-800">{result.answer}</p>
              {result.sources.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-500">المصادر المسترجعة:</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {result.sources.map((s, i) => <li key={i}>• {s.title} (تشابه {Math.round(s.similarity * 100)}٪)</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </NajahShell>
  );
}
