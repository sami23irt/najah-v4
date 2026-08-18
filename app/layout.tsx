import type { ReactNode } from "react";
import "./globals.css";
import { PostHogProvider } from "@/lib/posthog-client";

export const metadata = { title: "Najah.ma — منصة الامتحانات والمذاكرة" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#f7f6f0] text-slate-800 antialiased">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
