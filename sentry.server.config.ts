import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  // Server errors here can carry request bodies (e.g. copilot questions,
  // quiz answers). Sentry's default PII scrubbing stays on — do not set
  // sendDefaultPii: true for this project.
});
