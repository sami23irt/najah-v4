import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient, createServiceClient } from "@/lib/supabase-server";
import { retrieveDocumentContext } from "@/lib/rag";
import { rateLimit } from "@/lib/rate-limit";
import { readJson, requireSameOrigin } from "@/lib/request";

const schema = z.object({
  documentId: z.string().uuid(),
  question: z.string().min(3).max(2000),
  locale: z.enum(["ar", "fr"]).default("fr"),
});

const GUARDRAIL = `Tu es l'assistant d'étude de Najah.ma. Réponds UNIQUEMENT à partir des extraits du support fourni ci-dessous, qui provient d'un document importé par l'élève lui-même (PDF ou transcription vidéo).
N'invente jamais une information absente de ces extraits. Si les extraits ne suffisent pas pour répondre avec certitude, dis-le clairement au lieu de deviner.`;

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req);
  if (sameOrigin) return sameOrigin;
  const client = await createRequestClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول لاستعمال المساعد الذكي." }, { status: 401 });
  const limited = rateLimit(req, { name: "study-chat", limit: 30, windowMs: 10 * 60_000, userId: user.id });
  if (limited) return limited;

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

  const chunks = await retrieveDocumentContext(question, documentId, 6);
  if (chunks.length === 0) {
    return NextResponse.json({
      answer:
        locale === "ar"
          ? "لا أجد في هذا المستند مقتطفاً يغطي سؤالك بدقة. حاول إعادة صياغة السؤال أو اطرح سؤالاً متعلقاً مباشرة بمحتوى الملف."
          : "Je ne trouve pas d'extrait de ce support qui réponde précisément à votre question. Essayez de la reformuler ou de rester sur le contenu du document.",
      grounded: false,
    });
  }

  const contextBlock = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GUARDRAIL }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extraits du support :\n${contextBlock}\n\nQuestion de l'élève (${locale === "ar" ? "réponds en arabe" : "réponds en français"}) : ${question}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 800 },
      }),
    }
  );
  if (!geminiResponse.ok) return NextResponse.json({ error: "تعذر توليد الإجابة حالياً." }, { status: 502 });

  const result = await geminiResponse.json();
  const answer: string =
    result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "تعذر توليد إجابة قابلة للاستخدام.";

  return NextResponse.json({ answer, grounded: true });
}
