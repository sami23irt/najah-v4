import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";

export default function ExamNotFound() {
  return (
    <NajahShell>
      <section className="najah-card mx-auto max-w-2xl px-6 py-16 text-center sm:px-10">
        <FileQuestion className="mx-auto size-12 text-amber-600" aria-hidden="true" />
        <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-amber-700">404</p>
        <h1 className="mt-3 text-3xl font-black text-emerald-950">هذا الامتحان غير متاح.</h1>
        <p className="mt-4 leading-7 text-slate-600">قد يكون الرابط قديماً أو لم يعد الامتحان منشوراً في الأرشيف.</p>
        <Link href="/archive" className="najah-button mt-8">العودة إلى الأرشيف <ArrowLeft className="size-4" aria-hidden="true" /></Link>
      </section>
    </NajahShell>
  );
}
