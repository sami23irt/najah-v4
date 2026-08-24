import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

type PersistentRateLimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
};

/**
 * Cross-instance limiter for serverless deployments. The local limiter remains
 * useful as a fast first line, while this RPC provides atomic shared state.
 */
export async function persistentRateLimit({
  scope,
  identifier,
  limit,
  windowMs,
}: PersistentRateLimitOptions): Promise<NextResponse | null> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .rpc("consume_api_rate_limit", {
      p_bucket_key: `${scope}:${identifier}`,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    })
    .single();

  // The route already applies the local per-instance limiter before reaching
  // this shared limiter. If PostgREST is temporarily serving a stale schema or
  // Supabase is unavailable, keep that first-line protection active instead of
  // making every legitimate upload fail with a misleading 503.
  if (error || !data) {
    console.error("Persistent rate limiter unavailable; using local limiter fallback", error?.message ?? "empty response");
    return null;
  }

  const result = data as { allowed: boolean; retry_after: number };
  if (result.allowed) return null;

  const response = NextResponse.json(
    { error: "عدد كبير جداً من الطلبات. حاول مجدداً بعد قليل." },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(Math.max(1, result.retry_after ?? 1)));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
