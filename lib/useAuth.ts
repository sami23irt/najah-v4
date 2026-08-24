"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { posthog } from "@/lib/posthog-client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
      if (data.user) posthog.identify(data.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) posthog.identify(session.user.id);
      if (event === "SIGNED_OUT") posthog.reset();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth?verified=1` } });
  const signIn = async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const resendVerification = async (email: string) => supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth?verified=1` } });
  const startLogin = async () => {
    const result = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback`, skipBrowserRedirect: true } });
    if (!result.error && result.data.url) window.location.assign(result.data.url);
    return result;
  };
  const signOut = () => supabase.auth.signOut();

  return { user, isAuthenticated: !!user, loading, signUp, signIn, resendVerification, startLogin, signOut };
}
