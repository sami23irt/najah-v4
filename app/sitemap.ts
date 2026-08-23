import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase-server";

export const revalidate = 3600;

type PublicExam = { id: number; updated_at?: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://najah.ma").replace(/\/$/, "");
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/archive`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return entries;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("exams")
      .select("id,updated_at")
      .eq("is_published", true)
      .limit(1000);
    for (const exam of (data as PublicExam[] | null) ?? []) {
      entries.push({
        url: `${baseUrl}/archive/${exam.id}`,
        lastModified: exam.updated_at ? new Date(exam.updated_at) : now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // Keep the core sitemap available if the data service is temporarily down.
  }

  return entries;
}
