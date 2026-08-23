import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  name: string;
  limit: number;
  windowMs: number;
  userId?: string;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function getClientIp(request: NextRequest): string {
  // On Vercel, x-forwarded-for is set by the trusted edge proxy. Use only the
  // first address and never accept an arbitrary client-provided chain in logs.
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

export function rateLimit(request: NextRequest, options: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  const key = `${options.name}:${getClientIp(request)}:${options.userId ?? "anonymous"}`;
  const current = buckets.get(key);

  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= options.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  const response = NextResponse.json(
    { error: "عدد كبير جداً من الطلبات. حاول مجدداً بعد قليل." },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(retryAfter));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
