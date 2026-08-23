import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PostHogProvider } from "@/lib/posthog-client";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL("https://najah.ma");

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Najah.ma — Réussir avec méthode",
    template: "%s | Najah.ma",
  },
  description: "Une plateforme marocaine pour réviser, comprendre et progresser.",
  applicationName: "Najah.ma",
  keywords: ["examens marocains", "révision", "bac maroc", "cours", "quiz", "Najah"],
  authors: [{ name: "Najah.ma" }],
  creator: "Najah.ma",
  publisher: "Najah.ma",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_MA",
    url: "/",
    siteName: "Najah.ma",
    title: "Najah.ma — Réussir avec méthode",
    description: "Révisez les examens marocains, transformez vos cours et progressez avec méthode.",
  },
  twitter: {
    card: "summary",
    title: "Najah.ma — Réussir avec méthode",
    description: "Une plateforme marocaine pour réviser, comprendre et progresser.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#063c32",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr-MA" dir="ltr">
      <body className="bg-[#f7f6f0] text-slate-800 antialiased">
        <a className="skip-link" href="#main-content">
          Aller au contenu principal
        </a>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
