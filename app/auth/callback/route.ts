import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/auth?error=oauth_failed", req.url));
  }

  const supabase = await createRequestClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("OAuth code exchange failed:", error.message);
    return NextResponse.redirect(new URL("/auth?error=oauth_failed", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
