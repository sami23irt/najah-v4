import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase-server";
import { createGeminiStreamResponse } from "@/lib/gemini-stream";
import { retrieveCurriculumContext } from "@/lib/rag";
import { rateLimit } from "@/lib/rate-limit";
import { readJson, requireSameOrigin } from "@/lib/request";

const levelSchema = z.enum(["3AC", "TRC", "1BAC", "2BAC"]);

const requestSchema = z.object({
  level: levelSchema,
  subject: z.string().min(2).max(120),
  question: z.string().min(8).max(5000),
  locale: z.enum(["ar", "fr"]).default("ar"),
});

const GUARDRAIL = `Tu es Najah Copilot, assistant pédagogique pour les élèves du secondaire marocain.
Réponds uniquement à partir des extraits du programme officiel fournis ci-dessous.
N'invente jamais de règle, de formule ou de référence qui n'apparaît pas dans ces extraits.
Si les extraits ne suffisent pas pour répondre avec certitude, dis-le clairement au lieu de deviner.
Cite le document source par son titre quand tu t'appuies dessus.`;

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req);
  if (sameOrigin) return sameOrigin;

  const supabase = await createRequestClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول لاستعمال المساعد الذكي." }, { status: 401 });

  const limited = rateLimit(req, { name: "copilot", limit: 30, windowMs: 10 * 60_000, userId: user.id });
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { level, subject, question, locale } = parsed.data;

  let chunks;
  try {
    chunks = await retrieveCurriculumContext(question, level, subject);
  } catch {
    return NextResponse.json({ error: "تعذر البحث في المقرر حالياً." }, { status: 503 });
  }

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: locale === "ar"
        ? "لا أملك مقتطفاً موثوقاً من المقرر الرسمي يغطي هذا السؤال بدقة، لذلك لا أستطيع تأكيد إجابة. يمكنك إعادة صياغة السؤال أو التواصل مع أستاذك للتأكد من العنصر المطلوب."
        : "Je n'ai pas d'extrait fiable du programme officiel couvrant précisément cette question, donc je ne peux pas confirmer de réponse.",
      sources: [],
      grounded: false,
    });
  }

  const contextBlock = chunks.map((chunk, index) => `[${index + 1}] (${chunk.documentTitle}) ${chunk.content}`).join("\n\n");
  try {
    return await createGeminiStreamResponse({
      systemInstruction: GUARDRAIL,
      prompt: `المستوى: ${level}\nالمادة: ${subject}\nمقتطفات المقرر المسترجعة:\n${contextBlock}\n\nسؤال التلميذ (${locale === "ar" ? "أجب بالعربية" : "répondre en français"}): ${question}`,
      maxOutputTokens: 900,
      metadata: {
        grounded: true,
        sources: chunks.map(chunk => ({ title: chunk.documentTitle, similarity: Math.round(chunk.similarity * 100) / 100 })),
      },
    });
  } catch {
    return NextResponse.json({ error: "تعذر توليد الإجابة حالياً." }, { status: 502 });
  }
}
