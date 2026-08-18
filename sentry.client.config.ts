import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Keep this modest: study rooms involve long-lived LiveKit sessions, and
  // 100% tracing there would be noisy and costly. 10% is enough to catch
  // systemic slowness without drowning in room-session spans.
  tracesSampleRate: 0.1,
  // No session replay for now — the app handles student data (names,
  // exam answers, quiz results) and replay would need its own privacy
  // review before it's worth turning on.
  environment: process.env.NODE_ENV,
});
