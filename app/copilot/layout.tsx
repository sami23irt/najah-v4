import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assistant IA",
  robots: { index: false, follow: false },
};

export default function CopilotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
