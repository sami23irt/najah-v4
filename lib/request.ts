import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MAX_JSON_BYTES = 256 * 1024;

export async function readJson(request: NextRequest): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) return null;
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_JSON_BYTES) return null;
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return null;
  }
}

/**
 * CSRF defense for cookie-authenticated state-changing routes.
 * SameSite cookies are defense-in-depth; sensitive browser requests must carry
 * an exact same-origin Origin header. These endpoints are browser-facing, so
 * requests with no Origin are rejected rather than treated as trusted.
 */
export function requireSameOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "رأس Origin مطلوب." }, { status: 403 });

  const expectedOrigin = request.nextUrl.origin;
  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: "طلب من مصدر غير مسموح." }, { status: 403 });
  }
  return null;
}
