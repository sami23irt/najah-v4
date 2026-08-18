"use client";

import { useState } from "react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { levels, labelForLevel, subjects, type Level } from "@/lib/catalog";

export default function QuizzesPage() {
  const { isAuthenticated, startLogin } = useAuth();
  const [level, setLevel] = useState<Level>("2BAC");
  const [subject, setSubject] = useState(subjects[0] ?? "Mathématiques");
  const [count, setCount] = useState(10);
  const [quiz, setQuiz] = useState<{ sessionId:string; questions:{question:string;options:string[]}[]; expiresAt:string } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true); setError(null); setResult(null);
    const res = await fetch("/api/quizzes/generate", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({level,subject,count}) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "تعذر إنشاء الاختبار.");
    setQuiz(data); setAnswers(Array(data.questions.length).fill(-1));
  };

  const submit = async () => {
    if (!quiz || answers.some(a => a < 0)) return setError("أجب عن جميع الأسئلة أولاً.");
    setBusy(true); setError(null);
    const res = await fetch("/api/quizzes/submit", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({sessionId:quiz.sessionId,answers}) });
    const data = await res.json(); setBusy(false);
    if (!res.ok) return setError(data.error ?? "تعذر إرسال الاختبار.");
    setResult(data);
  };

  if (!isAuthenticated) return <NajahShell><div className="rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-black text-emerald-950">سجّل الدخول لاستعمال مولد الاختبارات</h1><button onClick={startLogin} className="mt-5 rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white">دخول التلميذ</button></div></NajahShell>;

  return <NajahShell>
    <section className="max-w-3xl"><p className="section-kicker">AI + RAG</p><h1 className="mt-2 text-4xl font-black text-emerald-950">مولد MCQ من المقرر</h1><p className="mt-3 leading-7 text-slate-600">الأسئلة تُولد من السياق المسترجع ثم تُحفظ الإجابات الصحيحة على الخادم، لذلك لا يمكن للمتصفح تعديل النتيجة.</p></section>
    {!quiz && <div className="mt-8 max-w-2xl space-y-4 rounded-3xl bg-white p-6">
      <select value={level} onChange={e=>setLevel(e.target.value as Level)} className="w-full rounded-lg border p-3">{levels.map(v=><option key={v} value={v}>{labelForLevel[v]}</option>)}</select>
      <select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full rounded-lg border p-3">{subjects.map(v=><option key={v} value={v}>{v}</option>)}</select>
      <select value={count} onChange={e=>setCount(Number(e.target.value))} className="w-full rounded-lg border p-3"><option value={5}>5 أسئلة</option><option value={10}>10 أسئلة</option><option value={15}>15 سؤالاً</option><option value={20}>20 سؤالاً</option></select>
      <button onClick={generate} disabled={busy} className="w-full rounded-xl bg-emerald-900 py-3 font-black text-white disabled:opacity-50">{busy?"جارٍ إنشاء الاختبار…":"إنشاء الاختبار"}</button>
    </div>}
    {quiz && !result && <div className="mt-8 space-y-5">{quiz.questions.map((q,i)=><article key={i} className="rounded-3xl bg-white p-6"><h2 className="font-black text-emerald-950">{i+1}. {q.question}</h2><div className="mt-4 grid gap-2">{q.options.map((o,j)=><button key={j} onClick={()=>setAnswers(a=>a.map((x,k)=>k===i?j:x))} className={`rounded-xl border p-3 text-right font-bold ${answers[i]===j?"border-emerald-700 bg-emerald-50":"border-slate-200"}`}>{o}</button>)}</div></article>)}<button onClick={submit} disabled={busy} className="w-full rounded-xl bg-amber-400 py-3 font-black text-emerald-950">{busy?"جارٍ التصحيح…":"إرسال الاختبار"}</button></div>}
    {result && <div className="mt-8 rounded-3xl bg-white p-8"><p className="text-sm font-bold text-slate-500">النتيجة</p><p className="mt-2 text-5xl font-black text-emerald-950">{result.correctAnswers}/{result.totalQuestions}</p><p className="mt-2 font-bold">{result.percentage}%</p><div className="mt-6 space-y-4">{result.review.map((r:any,i:number)=><div key={i} className="rounded-2xl bg-slate-50 p-4"><p className="font-black">{i+1}. {r.question}</p><p className="mt-2 text-sm">الإجابة الصحيحة: {r.correctIndex+1}</p><p className="mt-1 text-sm text-slate-600">{r.explanation}</p></div>)}</div><button onClick={()=>{setQuiz(null);setResult(null)}} className="mt-6 rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white">اختبار جديد</button></div>}
    {error && <p className="mt-4 max-w-2xl rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{typeof error === "string" ? error : "حدث خطأ."}</p>}
  </NajahShell>;
}
