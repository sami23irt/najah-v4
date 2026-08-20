import type { ReactNode } from "react";
import "./globals.css";
import { PostHogProvider } from "@/lib/posthog-client";

export const metadata = {
  title: "Najah.ma — Réussir avec méthode",
  description: "Une plateforme marocaine pour réviser, comprendre et progresser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" dir="ltr">
      <body className="bg-[#f7f6f0] text-slate-800 antialiased">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
