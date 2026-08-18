"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { posthog } from "@/lib/posthog-client";
import { labelForLevel, levels, subjects, type Level } from "@/lib/catalog";
import { DoorOpen, LockKeyhole, Plus, Radio, UsersRound } from "lucide-react";

type Room = { id: number; name: string; description: string | null; level: Level | null; subject: string | null; max_members: number };

export default function RoomsPage() {
  const { isAuthenticated, startLogin, user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    supabase.from("study_rooms").select("id,name,description,level,subject,max_members").eq("kind", "open").order("created_at", { ascending: false }).then(({ data }) => setRooms(data ?? []));
  }, []);

  return (
    <NajahShell>
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="section-kicker">مراجعة جماعية</p>
          <h1 className="mt-2 text-3xl font-black text-emerald-950 sm:text-4xl">الغرف المفتوحة الآن.</h1>
          <p className="mt-3 max-w-2xl leading-8 text-slate-600">الغرف الخاصة لا تظهر في الدليل. تُمنح عضويتها فقط عبر رمز دخول يمنحه صاحب الغرفة.</p>
        </div>
        {isAuthenticated ? (
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white"><Plus className="size-4" />إنشاء غرفة</button>
        ) : (
          <button onClick={() => startLogin()} className="rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white">دخول لإنشاء غرفة</button>
        )}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.length ? rooms.map(room => (
          <article key={room.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-800"><UsersRound className="size-5" /></span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Radio className="size-3" />مفتوحة</span>
            </div>
            <h2 className="mt-5 text-xl font-black text-emerald-950">{room.name}</h2>
            <p className="mt-2 min-h-10 text-sm leading-6 text-slate-600">{room.description || "غرفة مراجعة منظمة."}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{room.level ? labelForLevel[room.level] : "كل المستويات"}</span>
              {room.subject && <span className="rounded-full bg-slate-100 px-2.5 py-1">{room.subject}</span>}
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{room.max_members} أعضاء كحدّ أقصى</span>
            </div>
            <Link href={`/rooms/${room.id}`} className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-700 hover:bg-slate-50">
              دخول الغرفة <DoorOpen className="size-4" />
            </Link>
          </article>
        )) : (
          <div className="col-span-full rounded-3xl border border-dashed border-emerald-950/20 bg-white px-6 py-16 text-center">
            <UsersRound className="mx-auto size-10 text-emerald-700" />
            <h2 className="mt-4 text-xl font-black text-emerald-950">لا توجد غرف مفتوحة حالياً</h2>
          </div>
        )}
      </section>

      {open && user && <RoomForm onClose={() => setOpen(false)} onCreated={id => router.push(`/rooms/${id}`)} />}
    </NajahShell>
  );
}

function RoomForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const supabase = createBrowserSupabaseClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"open" | "private">("open");
  const [level, setLevel] = useState<Level | "">("");
  const [subject, setSubject] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    // Access-code hashing happens server-side in a real deployment (RPC or
    // edge function) so the plain code never round-trips through the client
    // as anything other than what the user typed once, at creation time.
    const { data, error: err } = await supabase.rpc("create_study_room", {
      p_name: name,
      p_description: description || null,
      p_kind: kind,
      p_level: level || null,
      p_subject: subject || null,
      p_access_code: kind === "private" ? accessCode : null,
    });
    setPending(false);
    if (err) return setError(err.message);
    posthog.capture("room_created", { kind, level: level || null, subject: subject || null });
    onCreated(data as number);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6" dir="rtl">
        <h2 className="text-lg font-black text-emerald-950">إنشاء غرفة مراجعة</h2>
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="اسم الغرفة" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف قصير" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        <div className="grid grid-cols-2 gap-3">
          <select value={kind} onChange={e => setKind(e.target.value as "open" | "private")} className="rounded-lg border border-slate-200 px-3 py-2">
            <option value="open">مفتوحة</option>
            <option value="private">خاصة</option>
          </select>
          <select value={level} onChange={e => setLevel(e.target.value as Level)} className="rounded-lg border border-slate-200 px-3 py-2">
            <option value="">اختياري</option>
            {levels.map(v => <option key={v} value={v}>{labelForLevel[v]}</option>)}
          </select>
        </div>
        <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
          <option value="">اختياري</option>
          {subjects.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        {kind === "private" && <input required minLength={4} type="password" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="رمز الدخول" className="w-full rounded-lg border border-slate-200 px-3 py-2" />}
        <button disabled={pending} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-900 py-2.5 font-bold text-white disabled:opacity-50">
          <LockKeyhole className="size-4" />{pending ? "جارٍ الإنشاء…" : "إنشاء الغرفة"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
