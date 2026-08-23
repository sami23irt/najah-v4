import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase-server";
import ArchiveClient from "./ArchiveClient";

type ExamRow = {
  id: number;
  title: string;
  level: "3AC" | "TRC" | "1BAC" | "2BAC";
  subject: string;
  region: string | null;
  year: number;
  exam_type: string;
  session: string;
};

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "أرشيف الامتحانات الوطنية والجهوية",
  description: "تصفح أرشيف الامتحانات المغربية حسب المستوى والشعبة والمادة والجهة والسنة.",
  alternates: { canonical: "/archive" },
};

async function getPublishedExams(): Promise<ExamRow[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("exams")
      .select("id,title,level,subject,region,year,exam_type,session")
      .eq("is_published", true)
      .order("year", { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return data as ExamRow[];
  } catch {
    return [];
  }
}

export default async function ArchivePage() {
  const initialExams = await getPublishedExams();
  return <ArchiveClient initialExams={initialExams} />;
}
