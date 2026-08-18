import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient, createServiceClient } from "@/lib/supabase-server";
import { retrieveCurriculumContext } from "@/lib/rag";

const schema = z.object({
  level: z.enum(["3AC", "TRC", "1BAC", "2BAC"]),
  subject: z.string().min(2).max(120),
  count: z.number().int().min(5).max(20).default(10),
});

const questionSchema = z.object({
  question: z.string().min(3).max(1000),
  options: z.array(z.string().min(1).max(500)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1).max(1200),
  source: z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  const client = await createRequestClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { level, subject, count } = parsed.data;

  const chunks = await retrieveCurriculumContext(`أنشئ أسئلة اختيار من متعدد دقيقة في ${subject} للمستوى ${level}`, level, subject, 8);
  if (chunks.length < 2) {
    return NextResponse.json({ error: "لا توجد قاعدة معرفة كافية لإنشاء اختبار موثوق." }, { status: 422 });
  }

  const context = chunks.map((c, i) => `[${i + 1}] ${c.documentTitle}\n${c.content}`).join("\n\n");
  const prompt = `أنشئ ${count} أسئلة MCQ للمستوى ${level} في مادة ${subject}.\n\nالمصادر المسموح بها فقط:\n${context}\n\nقواعد صارمة: كل سؤال له 4 خيارات مختلفة، correctIndex من 0 إلى 3، تفسير قصير، ولا تضف معلومة غير موجودة في المصادر. أعد JSON فقط بالشكل {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","source":"..."}]}.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "أنت مولد اختبارات تعليمي. التزم حصراً بالمصادر المعطاة وأعد JSON صالحاً." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 5000, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) return NextResponse.json({ error: "تعذر إنشاء الاختبار حالياً." }, { status: 502 });

  const result = await response.json();
  const raw = result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "تعذر التحقق من صيغة الاختبار." }, { status: 502 }); }
  const questionsParsed = z.object({ questions: z.array(questionSchema).min(5).max(20) }).safeParse(json);
  if (!questionsParsed.success) return NextResponse.json({ error: "الاختبار المولد لم يجتز التحقق." }, { status: 502 });

  const questions = questionsParsed.data.questions.slice(0, count);
  const admin = createServiceClient();
  const { data: session, error } = await admin.from("quiz_sessions").insert({
    user_id: user.id,
    level,
    subject,
    questions,
    total_questions: questions.length,
  }).select("id,total_questions,expires_at").single();
  if (error || !session) return NextResponse.json({ error: "تعذر حفظ جلسة الاختبار." }, { status: 500 });

  return NextResponse.json({
    sessionId: session.id,
    totalQuestions: session.total_questions,
    expiresAt: session.expires_at,
    questions: questions.map(({ correctIndex: _correctIndex, ...question }) => question),
  });
}
