import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RoomClient from "./RoomClient";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "Salle de révision",
  description: "Une salle d’étude collaborative pour vous concentrer et réviser avec vos camarades.",
  robots: { index: false, follow: false },
};

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || Number(id) < 1) notFound();
  // Render a uniform shell for existing and private/non-member room IDs.
  // Membership and access-code checks happen inside the authenticated RPC.
  return <RoomClient id={id} />;
}
