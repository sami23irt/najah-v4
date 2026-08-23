import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient, createServiceClient } from "@/lib/supabase-server";
import { extractYoutubeVideoId, fetchYoutubeTranscript } from "@/lib/youtube-transcript";
import { ingestStudentDocumentChunks, generateStudySummary } from "@/lib/rag";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

const schema = z.object({ url: z.string().url() });

export async function POST(req: NextRequest) {
  const client = await createRequestClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const limited = rateLimit(req, { name: "study-youtube", limit: 10, windowMs: 60 * 60_000, userId: user.id });
  if (limited) return limited;

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "رابط غير صالح." }, { status: 400 });

  const videoId = extractYoutubeVideoId(parsed.data.url);
  if (!videoId) return NextResponse.json({ error: "الرجاء إدخال رابط يوتيوب صالح." }, { status: 400 });

  const admin = createServiceClient();
  const { data: doc, error: docError } = await admin
    .from("student_documents")
    .insert({ user_id: user.id, title: "Cours vidéo YouTube", source_type: "youtube", source_url: parsed.data.url, status: "processing" })
    .select("id")
    .single();
  if (docError || !doc) return NextResponse.json({ error: "تعذر إنشاء المستند." }, { status: 500 });

  try {
    const { title, text } = await fetchYoutubeTranscript(videoId);
    const chunkCount = await ingestStudentDocumentChunks(doc.id, text);
    const summary = await generateStudySummary(text, "fr");
    const finalTitle = title.slice(0, 255);

    await admin
      .from("student_documents")
      .update({ title: finalTitle, status: "ready", summary, char_count: text.length, updated_at: new Date().toISOString() })
      .eq("id", doc.id);

    return NextResponse.json({ documentId: doc.id, title: finalTitle, summary, chunkCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    const friendly =
      message === "YOUTUBE_NO_CAPTIONS" || message === "YOUTUBE_TRANSCRIPT_TOO_SHORT"
        ? "لا تتوفر ترجمة نصية كافية لهذا الفيديو (captions)، لذلك لا يمكن تحليله حالياً."
        : "تعذر تحليل هذا الفيديو. تأكد أن الرابط صحيح وأن الفيديو عام.";
    await admin.from("student_documents").update({ status: "failed", error_message: message }).eq("id", doc.id);
    return NextResponse.json({ error: friendly }, { status: 422 });
  }
}
