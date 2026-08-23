import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient, createServiceClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

const schema = z.object({
  documentId: z.string().uuid(),
  count: z.number().int().min(3).max(15).default(6),
});

const questionSchema = z.object({
  question: z.string().min(3).max(1000),
  options: z.array(z.string().min(1).max(500)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1).max(1200),
});

type DocumentChunkRow = { content: string; chunk_index: number };

function chooseRepresentativeChunks(rows: DocumentChunkRow[], maximum: number): DocumentChunkRow[] {
  if (rows.length <= maximum) return rows;
  return Array.from({ length: maximum }, (_, index) => {
    const position = Math.round((index * (rows.length - 1)) / (maximum - 1));
    return rows[position];
  });
}

export async function POST(req: NextRequest) {
  const client = await createRequestClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const limited = rateLimit(req, { name: "study-quiz", limit: 10, windowMs: 10 * 60_000, userId: user.id });
  if (limited) return limited;

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { documentId, count } = parsed.data;

  const admin = createServiceClient();
  const { data: doc } = await admin
    .from("student_documents")
    .select("id,title,status")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!doc || doc.status !== "ready") return NextResponse.json({ error: "المستند غير متاح." }, { status: 404 });

  const { data: chunkRows, error: chunkError } = await admin
    .from("student_document_chunks")
    .select("content,chunk_index")
    .eq("document_id", documentId)
    .order("chunk_index")
    .limit(200);
  if (chunkError || !chunkRows || chunkRows.length === 0) {
    return NextResponse.json({ error: "لا يوجد محتوى كافٍ لإنشاء اختبار." }, { status: 422 });
  }

  const selectedChunks = chooseRepresentativeChunks(chunkRows as DocumentChunkRow[], 14);
  const context = selectedChunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
  const prompt = `Crée ${count} questions à choix multiple UNIQUEMENT à partir du texte source ci-dessous, sans y ajouter d'information absente.\n\nTexte source :\n${context}\n\nRègles strictes : chaque question a exactement 4 options différentes, correctIndex entre 0 et 3, une explication brève. Réponds en JSON strict au format {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "Tu génères des quiz éducatifs strictement à partir du texte source fourni et renvoies un JSON valide." }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: "application/json" },
      }),
    }
  );
  if (!response.ok) return NextResponse.json({ error: "تعذر إنشاء الاختبار حالياً." }, { status: 502 });

  const result = await response.json();
  const raw = result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "تعذر التحقق من صيغة الاختبار." }, { status: 502 });
  }
  const questionsParsed = z.object({ questions: z.array(questionSchema).min(3).max(15) }).safeParse(json);
  if (!questionsParsed.success) return NextResponse.json({ error: "الاختبار المولد لم يجتز التحقق." }, { status: 502 });

  const questions = questionsParsed.data.questions.slice(0, count);
  const { data: session, error } = await admin
    .from("quiz_sessions")
    .insert({
      user_id: user.id,
      subject: doc.title.slice(0, 120),
      document_id: documentId,
      questions,
      total_questions: questions.length,
    })
    .select("id,total_questions,expires_at")
    .single();
  if (error || !session) return NextResponse.json({ error: "تعذر حفظ جلسة الاختبار." }, { status: 500 });

  return NextResponse.json({
    sessionId: session.id,
    totalQuestions: session.total_questions,
    expiresAt: session.expires_at,
    questions: questions.map(({ correctIndex: _correctIndex, ...question }) => question),
  });
}
