import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Basic CSRF defense for cookie-authenticated state-changing routes.
 * SameSite cookies help, but we also require same-origin browser requests.
 * Requests without Origin are allowed for non-browser/server clients.
 */
export function requireSameOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const expectedOrigin = request.nextUrl.origin;
  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: "طلب من مصدر غير مسموح." }, { status: 403 });
  }
  return null;
}
