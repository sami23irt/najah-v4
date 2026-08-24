import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createRequestClient } from "@/lib/supabase-server";
import { requireSameOrigin } from "@/lib/request";

type AuthenticatedContext = {
  supabase: Awaited<ReturnType<typeof createRequestClient>>;
  user: User;
};

type AuthFailure = { response: NextResponse };

/**
 * Keeps the security order identical across API routes:
 * same-origin check, request-scoped Supabase client, then authenticated user.
 */
export async function requireAuthenticatedUser(
  request: NextRequest,
  unauthenticatedMessage: string
): Promise<AuthenticatedContext | AuthFailure> {
  const sameOrigin = requireSameOrigin(request);
  if (sameOrigin) return { response: sameOrigin };

  const supabase = await createRequestClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: unauthenticatedMessage }, { status: 401 }) };

  return { supabase, user };
}
