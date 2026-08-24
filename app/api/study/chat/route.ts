import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase-server";
import { createGeminiStreamResponse } from "@/lib/gemini-stream";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { retrieveDocumentContext } from "@/lib/rag";
import { rateLimit } from "@/lib/rate-limit";
import { persistentRateLimit } from "@/lib/server-rate-limit";
import { readJson } from "@/lib/request";

export const maxDuration = 60;

const schema = z.object({
  documentId: z.string().uuid(),
  question: z.string().min(3).max(2000),
  locale: z.enum(["ar", "fr"]).default("fr"),
});

const GUARDRAIL = `Tu es l'assistant d'étude de Najah.ma. Réponds UNIQUEMENT à partir des extraits du support fourni ci-dessous, qui provient d'un document importé par l'élève lui-même (PDF ou transcription vidéo).
N'invente jamais une information absente de ces extraits. Si les extraits ne suffisent pas pour répondre avec certitude, dis-le clairement au lieu de deviner.`;

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, "يجب تسجيل الدخول لاستعمال المساعد الذكي.");
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const limited = rateLimit(req, { name: "study-chat", limit: 30, windowMs: 10 * 60_000, userId: user.id });
  if (limited) return limited;
  const persistentLimited = await persistentRateLimit({ scope: "study-chat", identifier: user.id, limit: 30, windowMs: 10 * 60_000 });
  if (persistentLimited) return persistentLimited;

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { documentId, question, locale } = parsed.data;

  const admin = createServiceClient();
  const { data: doc } = await admin
    .from("student_documents")
    .select("id,status")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!doc || doc.status !== "ready") return NextResponse.json({ error: "المستند غير متاح." }, { status: 404 });

  let chunks;
  try {
    chunks = await retrieveDocumentContext(question, documentId, 6);
  } catch {
    return NextResponse.json({ error: "تعذر البحث في المستند حالياً." }, { status: 503 });
  }

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: locale === "ar"
        ? "لا أجد في هذا المستند مقتطفاً يغطي سؤالك بدقة. حاول إعادة صياغة السؤال أو اطرح سؤالاً متعلقاً مباشرة بمحتوى الملف."
        : "Je ne trouve pas d'extrait de ce support qui réponde précisément à votre question. Essayez de la reformuler ou de rester sur le contenu du document.",
      grounded: false,
    });
  }

  const contextBlock = chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join("\n\n");
  try {
    return await createGeminiStreamResponse({
      systemInstruction: GUARDRAIL,
      prompt: `Extraits du support :\n${contextBlock}\n\nQuestion de l'élève (${locale === "ar" ? "réponds en arabe" : "réponds en français"}) : ${question}`,
      maxOutputTokens: 800,
      metadata: { grounded: true },
    });
  } catch {
    return NextResponse.json({ error: "تعذر توليد الإجابة حالياً." }, { status: 502 });
  }
}
