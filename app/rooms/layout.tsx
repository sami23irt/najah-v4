import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salles de révision",
  robots: { index: false, follow: false },
};

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
