"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NajahShell } from "@/components/NajahShell";
import { VideoRoom } from "@/components/VideoRoom";
import { useAuth } from "@/lib/useAuth";
import { useRoomRealtime, type RoomMessage } from "@/lib/useRoomRealtime";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { MessageCircleMore, Pause, Play, Send, TimerReset, UsersRound } from "lucide-react";

const timeFormat = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function RoomDetailPage({ id }: { id: string }) {
  const roomId = Number(id);
  const { isAuthenticated, user, startLogin } = useAuth();
  const supabase = createBrowserSupabaseClient();
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [history, setHistory] = useState<RoomMessage[]>([]);
  const [body, setBody] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [isHost, setIsHost] = useState(false);

  const { connected, timer, liveMessages, presence, syncTimer } = useRoomRealtime(
    joined ? roomId : undefined,
    user?.id,
    user?.user_metadata?.name ?? "تلميذ"
  );

  const join = async (code?: string) => {
    const { error } = await supabase.rpc("join_study_room", { p_room_id: roomId, p_access_code: code ?? null });
    if (error) return setJoinError(error.message);
    setJoinError(null);
    setJoined(true);
    const { data: membership } = await supabase.from("room_members").select("role").eq("room_id", roomId).eq("user_id", user!.id).maybeSingle();
    setIsHost(membership?.role === "host" || membership?.role === "moderator");
    const [{ data: room }, { data: messages }] = await Promise.all([
      supabase.from("study_rooms").select("timer_phase,timer_ends_at").eq("id", roomId).single(),
      supabase
        .from("room_messages")
        .select("id,body,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);
    if (room) {
      // Seed the realtime timer from persisted state so a newly joined client
      // does not incorrectly display 00:00 until the next broadcast.
      syncTimer({ phase: room.timer_phase, endsAt: room.timer_ends_at });
    }
    setHistory((messages ?? []).map(m => ({ ...m, pseudonym: null, show_pseudonym: false })));
  };

  useEffect(() => {
    if (isAuthenticated && Number.isInteger(roomId) && roomId > 0) void join();
  }, [isAuthenticated, roomId]);

  useEffect(() => {
    const tick = () => setRemaining(timer.endsAt ? Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - Date.now()) / 1000)) : 0);
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [timer.endsAt]);

  const visibleMessages = useMemo(() => {
    const unique = new Map<number, RoomMessage>();
    for (const m of history) unique.set(m.id, m);
    for (const m of liveMessages) unique.set(m.id, m);
    return Array.from(unique.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [history, liveMessages]);

  const label = timer.phase === "focus" ? "وقت التركيز" : timer.phase === "break" ? "وقت الراحة" : "المؤقت متوقف";

  const toggleTimer = async () => {
    const phase = timer.phase === "focus" ? "break" : "focus";
    const durationSeconds = phase === "focus" ? 50 * 60 : 10 * 60;
    const { data, error } = await supabase.rpc("set_room_timer", {
      p_room_id: roomId,
      p_phase: phase,
      p_duration_seconds: durationSeconds,
    });
    if (error || !data?.[0]) return;
    syncTimer({ phase: data[0].timer_phase, endsAt: data[0].timer_ends_at });
  };

  const stopTimer = async () => {
    const { data, error } = await supabase.rpc("set_room_timer", {
      p_room_id: roomId,
      p_phase: "paused",
      p_duration_seconds: null,
    });
    if (error || !data?.[0]) return;
    syncTimer({ phase: data[0].timer_phase, endsAt: data[0].timer_ends_at });
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !user) return;
    const { data, error } = await supabase.from("room_messages").insert({ room_id: roomId, user_id: user.id, body: body.trim() }).select("id,body,created_at").single();
    if (!error && data) {
      setBody("");
    }
  };

  if (!isAuthenticated) {
    return (
      <NajahShell>
        <div className="rounded-3xl bg-white p-10 text-center">
          <UsersRound className="mx-auto size-10 text-emerald-700" />
          <h1 className="mt-4 text-2xl font-black text-emerald-950">سجّل الدخول للانضمام إلى الغرفة</h1>
          <button onClick={() => startLogin()} className="mt-5 rounded-xl bg-emerald-900 px-5 py-2.5 font-bold text-white">دخول التلميذ</button>
        </div>
      </NajahShell>
    );
  }

  return (
    <NajahShell>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_.9fr]">
        <section className="space-y-5">
          {joined ? (
            <VideoRoom roomId={roomId} focusPhase={timer.phase} />
          ) : joinError ? (
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">{joinError}</p>
              <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); join(accessCode); }}>
                <input id="room-access-code" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="رمز دعوة الغرفة الخاصة" aria-label="رمز دعوة الغرفة الخاصة" type="password" className="flex-1 rounded-lg border border-slate-200 px-3 py-2" />
                <button type="submit" className="rounded-xl bg-emerald-900 px-4 py-2 font-bold text-white">انضمام</button>
              </form>
            </div>
          ) : (
            <div className="grid h-[70vh] place-items-center text-sm text-slate-500">جارٍ الانضمام…</div>
          )}

          <article className="rounded-3xl bg-emerald-950 p-6 text-white">
            <div className="flex items-center gap-2 text-amber-200"><TimerReset className="size-5" /><span className="text-sm font-bold">{connected ? "متصل بالمزامنة" : "جارٍ التحقق من الاتصال"}</span></div>
            <p className="mt-4 text-center text-sm text-emerald-50/70">{label}</p>
            <p className="mt-2 text-center text-5xl font-black tracking-tight">{timeFormat(remaining)}</p>
            {isHost ? (
              <div className="mt-5 flex gap-2">
                <button onClick={toggleTimer} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 font-black text-emerald-950"><Play className="size-4" />بدء الجلسة التالية</button>
                <button onClick={stopTimer} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 px-4 py-2.5 font-bold"><Pause className="size-4" />إيقاف</button>
              </div>
            ) : (
              <p className="mt-5 text-center text-xs text-emerald-50/60">يملك صاحب الغرفة والمشرفون صلاحية تشغيل المؤقت.</p>
            )}
          </article>
        </section>

        <section className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-950/10 px-5 py-4">
            <h1 className="flex items-center gap-2 text-xl font-black text-emerald-950"><MessageCircleMore className="size-5 text-emerald-700" />دردشة الغرفة</h1>
            <span className="text-xs text-slate-500">{presence.length} متصل</span>
          </div>
          <div className="h-[400px] space-y-3 overflow-y-auto p-5">
            {visibleMessages.slice().reverse().map(m => (
              <div key={m.id} className="rounded-2xl bg-[#f7f6f0] p-3">
                <p className="mt-1 text-sm leading-6 text-slate-700">{m.body}</p>
              </div>
            ))}
            {!visibleMessages.length && <p className="py-16 text-center text-sm text-slate-500">لا توجد رسائل بعد.</p>}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2 border-t border-emerald-950/10 p-4">
            <input id="room-message" value={body} onChange={e => setBody(e.target.value)} maxLength={1000} placeholder="اكتب رسالة…" aria-label="رسالة الغرفة" className="flex-1 rounded-lg border border-slate-200 px-3 py-2" />
            <button type="submit" aria-label="إرسال رسالة الغرفة" className="rounded-xl bg-emerald-900 px-4 py-2 text-white"><Send className="size-4" aria-hidden="true" /></button>
          </form>
        </section>
      </div>
    </NajahShell>
  );
}
