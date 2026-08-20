import { NextRequest, NextResponse } from "next/server";
import { createRequestClient, createServiceClient } from "@/lib/supabase-server";
import { extractPdfText } from "@/lib/pdf-extract";
import { ingestStudentDocumentChunks, generateStudySummary } from "@/lib/rag";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const client = await createRequestClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول لاستيراد ملف." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم إرفاق ملف." }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "الملفات المدعومة حالياً: PDF فقط." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "حجم الملف يتجاوز 20 ميغابايت." }, { status: 413 });

  const admin = createServiceClient();
  const title = (file.name.replace(/\.pdf$/i, "").trim() || "Support importé").slice(0, 255);

  const { data: doc, error: docError } = await admin
    .from("student_documents")
    .insert({ user_id: user.id, title, source_type: "pdf", status: "processing" })
    .select("id")
    .single();
  if (docError || !doc) return NextResponse.json({ error: "تعذر إنشاء المستند." }, { status: 500 });

  try {
    const buffer = await file.arrayBuffer();
    const storagePath = `${user.id}/${doc.id}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("study-uploads")
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(`STORAGE_UPLOAD_FAILED: ${uploadError.message}`);

    const text = await extractPdfText(buffer);
    const chunkCount = await ingestStudentDocumentChunks(doc.id, text);
    const summary = await generateStudySummary(text, "fr");

    await admin
      .from("student_documents")
      .update({
        storage_path: storagePath,
        status: "ready",
        summary,
        char_count: text.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    return NextResponse.json({ documentId: doc.id, title, summary, chunkCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    const friendly =
      message === "PDF_TEXT_TOO_SHORT"
        ? "تعذر استخراج نص كافٍ من هذا الملف. تأكد أنه ليس صورة ممسوحة ضوئياً بدون نص قابل للتحديد."
        : "تعذر تحليل الملف. حاول مجدداً أو جرّب ملفاً آخر.";
    await admin.from("student_documents").update({ status: "failed", error_message: message }).eq("id", doc.id);
    return NextResponse.json({ error: friendly }, { status: 422 });
  }
}
