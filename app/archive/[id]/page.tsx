import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase-server";
import ExamReaderClient from "./ExamReaderClient";

type Props = { params: Promise<{ id: string }> };
type ExamFile = { kind: "subject" | "correction" | "resource"; storage_path: string };
type PublishedExam = { id: number; title: string; curriculum_reference: string | null; files: ExamFile[] };

export const dynamic = "force-dynamic";

async function getPublishedExam(id: string): Promise<{ exam: PublishedExam | null; failed: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { exam: null, failed: true };
  }

  try {
    const supabase = createServiceClient();
    const { data: examRow, error: examError } = await supabase
      .from("exams")
      .select("id,title,curriculum_reference")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (examError) return { exam: null, failed: true };
    if (!examRow) return { exam: null, failed: false };

    const { data: files, error: filesError } = await supabase
      .from("exam_files")
      .select("kind,storage_path")
      .eq("exam_id", id);
    if (filesError) return { exam: { ...(examRow as Omit<PublishedExam, "files">), files: [] }, failed: true };
    return { exam: { ...(examRow as Omit<PublishedExam, "files">), files: (files as ExamFile[] | null) ?? [] }, failed: false };
  } catch {
    return { exam: null, failed: true };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id) || Number(id) < 1) return { title: "امتحان غير موجود" };
  const { exam } = await getPublishedExam(id);
  return {
    title: exam?.title || "قارئ الامتحان",
    description: exam ? `اقرأ ${exam.title} من أرشيف الامتحانات المغربية في Najah.ma.` : "اقرأ الامتحانات والوثائق المرفقة من أرشيف Najah.ma.",
    alternates: { canonical: `/archive/${id}` },
  };
}

export default async function ExamReaderPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || Number(id) < 1) notFound();

  const { exam, failed } = await getPublishedExam(id);
  if (!failed && !exam) notFound();
  return <ExamReaderClient id={id} initialExam={exam ?? undefined} />;
}
