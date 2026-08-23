import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://*.posthog.com`,
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://*.posthog.com https://*.sentry.io",
      "frame-src 'self' https://*.youtube.com https://*.youtube-nocookie.com https://*.livekit.cloud",
      "media-src 'self' blob: https:",
      ...(isProduction ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  compress: true,
  generateEtags: true,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "iratta",
  project: "najah-ma",
  // Source maps are only uploaded when SENTRY_AUTH_TOKEN is set (CI/prod
  // build), so local dev builds don't need a token at all.
  silent: true,
  widenClientFileUpload: true,
  // Keep Sentry's default cron/tunnel routes off; the app doesn't use them.
  webpack: { treeshake: { removeDebugLogging: true } },
});
