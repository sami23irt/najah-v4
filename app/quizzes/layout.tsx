import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz interactifs",
  robots: { index: false, follow: false },
};

export default function QuizzesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
