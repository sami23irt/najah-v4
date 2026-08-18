import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase-server";
import { refreshLeaderboardForUser } from "@/lib/leaderboard";
import { captureServerEvent } from "@/lib/posthog-server";

const sessionSchema = z.object({
  kind: z.literal("session"),
  roomId: z.number().int().positive().optional(),
  subject: z.string().max(120).optional(),
  durationMinutes: z.number().int().min(1).max(60),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  const started = new Date(value.startedAt).getTime();
  const completed = new Date(value.completedAt).getTime();
  if (!Number.isFinite(started) || started > Date.now() + 5 * 60_000) {
    ctx.addIssue({ code: "custom", path: ["startedAt"], message: "startedAt is invalid or in the future" });
  }
  if (!Number.isFinite(completed) || completed < started) {
    ctx.addIssue({ code: "custom", path: ["completedAt"], message: "completedAt must be after startedAt" });
  }
});

export async function POST(req: NextRequest) {
  const supabase = await createRequestClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });

  const parsed = sessionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { roomId, subject, startedAt, completedAt } = parsed.data;
  const derivedMinutes = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60_000);
  if (Math.abs(derivedMinutes - parsed.data.durationMinutes) > 1) {
    return NextResponse.json({ error: "مدة الجلسة لا تطابق وقت البداية والنهاية." }, { status: 400 });
  }

  const { error } = await supabase.rpc("record_study_session", {
    p_room_id: roomId ?? null,
    p_subject: subject ?? null,
    p_started_at: startedAt,
    p_completed_at: completedAt,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    await refreshLeaderboardForUser(user.id);
  } catch (error) {
    console.error("Leaderboard refresh failed after recording activity:", error);
  }

  void captureServerEvent(user.id, "study_session_recorded", {
    duration_minutes: parsed.data.durationMinutes,
    subject: subject ?? null,
    in_room: Boolean(roomId),
  });

  return NextResponse.json({ ok: true });
}
