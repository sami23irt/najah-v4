import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  examId: z.coerce.number().int().positive(),
  kind: z.enum(["subject", "correction", "resource"]),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "archive-file", limit: 60, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const parsed = requestSchema.safeParse({
    examId: req.nextUrl.searchParams.get("examId"),
    kind: req.nextUrl.searchParams.get("kind"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: file } = await supabase
    .from("exam_files")
    .select("storage_path")
    .eq("exam_id", parsed.data.examId)
    .eq("kind", parsed.data.kind)
    .maybeSingle();

  const { data: exam } = await supabase
    .from("exams")
    .select("id")
    .eq("id", parsed.data.examId)
    .eq("is_published", true)
    .maybeSingle();

  if (!file || !exam) {
    return NextResponse.json({ error: "الملف غير متاح." }, { status: 404 });
  }

  const { data, error } = await supabase
    .storage
    .from("exams")
    .createSignedUrl(file.storage_path, 15 * 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "تعذر إنشاء رابط الملف." }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    event_type: "exam_file_accessed",
    target_type: "exam_file",
    target_id: `${parsed.data.examId}:${parsed.data.kind}`,
    metadata: { exam_id: parsed.data.examId, kind: parsed.data.kind },
  });

  return NextResponse.json({ url: data.signedUrl });
}
