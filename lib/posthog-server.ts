import { PostHog } from "posthog-node";

let client: PostHog | null = null;

/**
 * Server-side capture (API routes only). PostHog's Node client batches and
 * flushes on an interval/queue size — call posthog.shutdown() is NOT needed
 * per-request in a serverless/edge-adjacent Next.js route; we flush
 * explicitly after each capture instead, since a Next.js API route's
 * process can be frozen right after the response is sent.
 */
export function getServerPostHog(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Fire-and-forget capture that never throws into the caller's request
 * handling — analytics must not be able to break a real feature (quiz
 * submission, study session recording, room creation, account deletion).
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  try {
    const posthog = getServerPostHog();
    if (!posthog) return;
    posthog.capture({ distinctId, event, properties });
    await posthog.flush();
  } catch (err) {
    console.error(`Failed to capture PostHog event "${event}":`, err);
  }
}
