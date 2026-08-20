import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;
const previewUrl = "https://preview-placeholder.supabase.co";
const previewKey = "preview-anon-key";

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || previewUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || previewKey
  );
  return browserClient;
}
