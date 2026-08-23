import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase-server";
import RoomClient from "./RoomClient";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "غرفة المراجعة",
  description: "غرفة دراسة تعاونية للتركيز والمراجعة مع زملائك.",
  robots: { index: false, follow: false },
};

async function roomExists(id: string): Promise<boolean | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("study_rooms").select("id").eq("id", id).maybeSingle();
    if (error) return null;
    return Boolean(data);
  } catch {
    return null;
  }
}

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || Number(id) < 1) notFound();
  if ((await roomExists(id)) === false) notFound();
  return <RoomClient id={id} />;
}
