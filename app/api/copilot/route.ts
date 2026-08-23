import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase-server";
import { retrieveCurriculumContext } from "@/lib/rag";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

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
  // 1. Auth check — RLS-backed client, so this also confirms the session is real.
  const supabase = await createRequestClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول لاستعمال المساعد الذكي." }, { status: 401 });
  }
  const limited = rateLimit(req, { name: "copilot", limit: 30, windowMs: 10 * 60_000, userId: user.id });
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { level, subject, question, locale } = parsed.data;

  // 2. Retrieval — this is the part that was completely missing before:
  // actual nearest-neighbour search over embedded curriculum chunks, not a
  // user-pasted excerpt.
  const chunks = await retrieveCurriculumContext(question, level, subject);

  if (chunks.length === 0) {
    return NextResponse.json({
      answer:
        locale === "ar"
          ? "لا أملك مقتطفاً موثوقاً من المقرر الرسمي يغطي هذا السؤال بدقة، لذلك لا أستطيع تأكيد إجابة. يمكنك إعادة صياغة السؤال أو التواصل مع أستاذك للتأكد من العنصر المطلوب."
          : "Je n'ai pas d'extrait fiable du programme officiel couvrant précisément cette question, donc je ne peux pas confirmer de réponse.",
      sources: [],
      grounded: false,
    });
  }

  const contextBlock = chunks
    .map((c, i) => `[${i + 1}] (${c.documentTitle}) ${c.content}`)
    .join("\n\n");

  // 3. Generation, grounded in the retrieved context only.
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
                text: `المستوى: ${level}\nالمادة: ${subject}\nمقتطفات المقرر المسترجعة:\n${contextBlock}\n\nسؤال التلميذ (${locale === "ar" ? "أجب بالعربية" : "répondre en français"}): ${question}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 900 },
      }),
    }
  );

  if (!geminiResponse.ok) {
    return NextResponse.json({ error: "تعذر توليد الإجابة حالياً." }, { status: 502 });
  }

  const result = await geminiResponse.json();
  const answer: string =
    result.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
    "تعذر توليد إجابة قابلة للاستخدام.";

  return NextResponse.json({
    answer,
    sources: chunks.map(c => ({ title: c.documentTitle, similarity: Math.round(c.similarity * 100) / 100 })),
    grounded: true,
  });
}
