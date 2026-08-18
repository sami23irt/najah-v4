import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  org: "iratta",
  project: "najah-ma",
  // Source maps are only uploaded when SENTRY_AUTH_TOKEN is set (CI/prod
  // build), so local dev builds don't need a token at all.
  silent: true,
  widenClientFileUpload: true,
  // Keep Sentry's default cron/tunnel routes off; the app doesn't use them.
  disableLogger: true,
});
