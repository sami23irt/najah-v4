import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient, createServiceClient } from "@/lib/supabase-server";
import { refreshLeaderboardForUser } from "@/lib/leaderboard";
import { captureServerEvent } from "@/lib/posthog-server";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

const schema = z.object({ sessionId: z.string().uuid(), answers: z.array(z.number().int().min(0).max(3)).max(20) });
const storedQuestion = z.object({ correctIndex: z.number().int().min(0).max(3), explanation: z.string(), question: z.string(), options: z.array(z.string()).length(4), source: z.string().optional() });

export async function POST(req: NextRequest) {
  const client = await createRequestClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  const limited = rateLimit(req, { name: "quiz-submit", limit: 20, windowMs: 10 * 60_000, userId: user.id });
  if (limited) return limited;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createServiceClient();
  const { data: session, error } = await admin
    .from("quiz_sessions")
    .select("id,user_id,level,subject,document_id,questions,total_questions,correct_answers,expires_at,submitted_at")
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .single();
  if (error || !session) return NextResponse.json({ error: "جلسة الاختبار غير موجودة." }, { status: 404 });
  if (session.submitted_at) return NextResponse.json({ error: "تم إرسال هذا الاختبار مسبقاً." }, { status: 409 });
  if (new Date(session.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "انتهت صلاحية الاختبار." }, { status: 410 });

  const questions = z.array(storedQuestion).safeParse(session.questions);
  if (!questions.success || parsed.data.answers.length !== questions.data.length) return NextResponse.json({ error: "عدد الإجابات غير مطابق." }, { status: 400 });
  const correctAnswers = questions.data.reduce((score, q, i) => score + (q.correctIndex === parsed.data.answers[i] ? 1 : 0), 0);

  const { data: claimed, error: updateError } = await admin.from("quiz_sessions").update({ correct_answers: correctAnswers, submitted_at: new Date().toISOString() }).eq("id", session.id).is("submitted_at", null).select("id").maybeSingle();
  if (updateError) return NextResponse.json({ error: "تعذر تسجيل النتيجة." }, { status: 500 });
  if (!claimed) return NextResponse.json({ error: "تم إرسال هذا الاختبار مسبقاً." }, { status: 409 });

  const { error: attemptError } = await admin.from("quiz_attempts").insert({
    user_id: user.id,
    level: session.level,
    subject: session.subject,
    document_id: session.document_id ?? null,
    total_questions: questions.data.length,
    correct_answers: correctAnswers,
    curriculum_reference: session.document_id ? "AI-DOCUMENT-RAG" : "AI-RAG",
  });
  if (attemptError) return NextResponse.json({ error: "تم إنهاء الاختبار لكن تعذر حفظ المحاولة." }, { status: 500 });

  try { await refreshLeaderboardForUser(user.id); } catch (e) { console.error("Leaderboard refresh failed:", e); }
  void captureServerEvent(user.id, "quiz_submitted", {
    level: session.level,
    subject: session.subject,
    total_questions: questions.data.length,
    correct_answers: correctAnswers,
    percentage: Math.round((correctAnswers / questions.data.length) * 100),
  });
  return NextResponse.json({ correctAnswers, totalQuestions: questions.data.length, percentage: Math.round(correctAnswers / questions.data.length * 100), review: questions.data.map((q, i) => ({ question: q.question, selectedIndex: parsed.data.answers[i], correctIndex: q.correctIndex, explanation: q.explanation })) });
}
