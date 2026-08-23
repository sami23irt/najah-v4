import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مساحة المراجعة",
  robots: { index: false, follow: false },
};

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
