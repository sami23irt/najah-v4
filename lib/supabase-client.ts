import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Client components can be evaluated during a build/prerender. Keep that
    // phase deterministic without making a network call; fail loudly in the
    // actual browser where the missing deployment configuration matters.
    if (typeof window !== "undefined") {
      throw new Error("Supabase browser configuration is missing.");
    }
    browserClient = createBrowserClient(
      "https://preview-placeholder.supabase.co",
      "preview-anon-key"
    );
    return browserClient;
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
}
