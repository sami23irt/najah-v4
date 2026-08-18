"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";

let initialized = false;

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || initialized) return;
    initialized = true;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com",
      // Student platform: keep autocapture off. We only want to know that
      // a study session happened or a quiz was submitted, not a raw click
      // stream over exam content and room chat.
      autocapture: false,
      capture_pageview: true,
      person_profiles: "identified_only",
    });
  }, []);

  return <>{children}</>;
}

export { posthog };
