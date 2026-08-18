"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NajahShell } from "@/components/NajahShell";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { labelForLevel, levels, regions, subjects, tracks, type Level } from "@/lib/catalog";
import { CalendarDays, FileSearch, FilterX, LibraryBig, MapPinned, SlidersHorizontal } from "lucide-react";

type Filters = { level?: Level; track?: string; subject?: string; region?: string; year?: number; session?: "normal" | "makeup" };
type ExamRow = { id: number; title: string; level: Level; subject: string; region: string | null; year: number; exam_type: string; session: string };

const noValue = "__all__";

export default function ArchivePage() {
  const [filters, setFilters] = useState<Filters>({});
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    setLoading(true);
    let query = supabase.from("exams").select("id,title,level,subject,region,year,exam_type,session").eq("is_published", true);
    if (filters.level) query = query.eq("level", filters.level);
    if (filters.track) query = query.eq("track", filters.track);
    if (filters.subject) query = query.eq("subject", filters.subject);
    if (filters.region) query = query.eq("region", filters.region);
    if (filters.year) query = query.eq("year", filters.year);
    if (filters.session) query = query.eq("session", filters.session);
    query
      .order("year", { ascending: false })
      .then(({ data }) => {
        setExams(data ?? []);
        setLoading(false);
      });
  }, [filters]);

  const set = <K extends keyof Filters>(key: K, value?: Filters[K]) => setFilters(current => ({ ...current, [key]: value }));

  return (
    <NajahShell>
      <section className="max-w-4xl">
        <p className="section-kicker">أرشيف الامتحانات</p>
        <h1 className="mt-2 text-4xl font-black text-emerald-950">ابحث حسب مسارك الدراسي.</h1>
        <p className="mt-3 leading-8 text-slate-600">فلترة متعددة تساعدك على الوصول إلى الوثائق المنشورة مع مرجعها، ثم مقارنتها بتصحيحها في مساحة واحدة.</p>
      </section>

      <section className="mt-8 rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-emerald-950">
          <SlidersHorizontal className="size-5" />
          <h2 className="font-black">تصفية الأرشيف</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect label="المستوى" value={filters.level} items={levels.map(v => ({ value: v, label: labelForLevel[v] }))} onChange={v => set("level", v as Level)} />
          <FilterSelect label="المسلك" value={filters.track} items={tracks.map(v => ({ value: v, label: v }))} onChange={v => set("track", v)} />
          <FilterSelect label="المادة" value={filters.subject} items={subjects.map(v => ({ value: v, label: v }))} onChange={v => set("subject", v)} />
          <FilterSelect label="الجهة" value={filters.region} items={regions.map(v => ({ value: v, label: v }))} onChange={v => set("region", v)} />
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">السنة</label>
            <input
              type="number"
              min={2010}
              max={2035}
              placeholder="مثال: 2025"
              value={filters.year ?? ""}
              onChange={e => set("year", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <FilterSelect
            label="الدورة"
            value={filters.session}
            items={[{ value: "normal", label: "العادية" }, { value: "makeup", label: "الاستدراكية" }]}
            onChange={v => set("session", v as Filters["session"])}
          />
        </div>
        <button onClick={() => setFilters({})} className="mt-5 flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <FilterX className="size-4" />
          مسح المرشحات
        </button>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-emerald-950">النتائج</h2>
          <span className="text-sm text-slate-500">{exams.length} وثيقة منشورة</span>
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : exams.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {exams.map(exam => (
              <article key={exam.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-amber-700">{exam.exam_type === "national" ? "وطني" : "جهوي"} · دورة {exam.session === "normal" ? "عادية" : "استدراكية"}</p>
                    <h3 className="mt-2 text-xl font-black text-emerald-950">{exam.title}</h3>
                  </div>
                  <LibraryBig className="size-6 shrink-0 text-emerald-700" />
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1">{labelForLevel[exam.level]}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">{exam.subject}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1"><CalendarDays className="size-3" />{exam.year}</span>
                  {exam.region && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1"><MapPinned className="size-3" />{exam.region}</span>}
                </div>
                <Link href={`/archive/${exam.id}`} className="mt-5 block w-full rounded-xl bg-emerald-900 py-2.5 text-center font-bold text-white hover:bg-emerald-800">
                  فتح القارئ المزدوج
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-emerald-950/20 bg-white px-6 py-16 text-center">
            <FileSearch className="mx-auto size-10 text-emerald-700" />
            <h3 className="mt-4 text-xl font-black text-emerald-950">لا توجد وثائق منشورة بهذه المعايير</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-600">جرّب تغيير المرشحات.</p>
          </div>
        )}
      </section>
    </NajahShell>
  );
}

function FilterSelect({ label, value, items, onChange }: { label: string; value?: string; items: { value: string; label: string }[]; onChange: (value?: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700">{label}</label>
      <select
        value={value ?? noValue}
        onChange={e => onChange(e.target.value === noValue ? undefined : e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
      >
        <option value={noValue}>الكل</option>
        {items.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
  );
}
