"use client";

import { useEffect, useState } from "react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { labelForLevel, levels, regions, tracks, type Level } from "@/lib/catalog";
import { CheckCircle2, UserRoundCog, Trash2 } from "lucide-react";

export default function ProfilePage() {
  const { isAuthenticated, user, startLogin } = useAuth();
  const supabase = createBrowserSupabaseClient();
  const [level, setLevel] = useState<Level>("2BAC");
  const [track, setTrack] = useState("");
  const [region, setRegion] = useState("");
  const [pseudonym, setPseudonym] = useState("");
  const [showPseudonym, setShow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      if (data.level) setLevel(data.level);
      setTrack(data.track ?? "");
      setRegion(data.region ?? "");
      setPseudonym(data.pseudonym ?? "");
      setShow(data.show_pseudonym);
    });
  }, [user]);

  if (!isAuthenticated) {
    return (
      <NajahShell>
        <div className="rounded-3xl bg-white p-10 text-center">
          <UserRoundCog className="mx-auto size-10 text-emerald-700" />
          <h1 className="mt-4 text-2xl font-black text-emerald-950">أنشئ ملفك الدراسي</h1>
          <button onClick={() => startLogin()} className="mt-5 rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white">دخول التلميذ</button>
        </div>
      </NajahShell>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase.from("student_profiles").upsert({
      user_id: user!.id,
      level,
      track,
      region,
      pseudonym: pseudonym || null,
      show_pseudonym: showPseudonym,
      preferred_locale: "ar",
    });
    setSaving(false);
    setSaved(true);
  };


  const deleteAccount = async () => {
    if (!window.confirm("سيتم حذف حسابك وبياناتك نهائياً. هل تريد المتابعة؟")) return;
    setDeleting(true);
    setDeleteError(null);
    const response = await fetch("/api/account/delete", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDeleteError(result.error ?? "تعذر حذف الحساب.");
      setDeleting(false);
      return;
    }
    window.location.href = "/";
  };

  return (
    <NajahShell>
      <section className="max-w-2xl">
        <p className="section-kicker">الملف الدراسي</p>
        <h1 className="mt-2 text-4xl font-black text-emerald-950">ضبط مسار التعلّم.</h1>
      </section>
      <form onSubmit={save} className="mt-8 max-w-2xl space-y-4 rounded-3xl border border-emerald-950/10 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">المستوى</label>
            <select value={level} onChange={e => setLevel(e.target.value as Level)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
              {levels.map(v => <option key={v} value={v}>{labelForLevel[v]}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">المسلك</label>
            <select value={track} onChange={e => setTrack(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="">اختر المسلك</option>
              {tracks.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-bold text-slate-700">الأكاديمية / الجهة</label>
            <select value={region} onChange={e => setRegion(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="">اختر الجهة</option>
              {regions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">الاسم المستعار (اختياري)</label>
            <input maxLength={50} value={pseudonym} onChange={e => setPseudonym(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-[#f7f6f0] p-4">
          <p className="font-black text-emerald-950">إظهار الاسم المستعار في لوحة الشرف</p>
          <input type="checkbox" checked={showPseudonym} onChange={e => setShow(e.target.checked)} className="size-5" />
        </div>
        <button disabled={!track || !region || saving} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-900 py-2.5 font-bold text-white disabled:opacity-50">
          {saving ? "جارٍ الحفظ…" : <><CheckCircle2 className="size-4" />حفظ الملف</>}
        </button>
        {saved && <p className="text-center text-sm text-emerald-700">تم الحفظ.</p>}
      </form>

      <section className="mt-6 max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-black text-red-950">حذف الحساب</h2>
        <p className="mt-2 text-sm leading-6 text-red-900/80">يحذف حساب Supabase وبيانات الملف والغرف والسجلات المرتبطة به وفق سياسة الحذف في قاعدة البيانات.</p>
        <button onClick={deleteAccount} disabled={deleting} className="mt-4 flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 font-bold text-white disabled:opacity-50">
          <Trash2 className="size-4" />{deleting ? "جارٍ حذف الحساب…" : "حذف حسابي نهائياً"}
        </button>
        {deleteError && <p className="mt-3 text-sm font-bold text-red-700">{deleteError}</p>}
      </section>
    </NajahShell>
  );
}
