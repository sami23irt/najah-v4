import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://najah.ma";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/archive", "/archive/"],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/profile",
          "/study",
          "/copilot",
          "/quizzes",
          "/rooms",
        ],
      },
    ],
    sitemap: `${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
