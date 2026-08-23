"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The global boundary handles uncaught root errors; this boundary keeps
    // route-level failures recoverable without exposing implementation details.
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f0] p-6 text-center" dir="ltr">
      <section className="najah-card max-w-lg px-6 py-14 sm:px-10" role="alert" aria-live="assertive">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">Erreur temporaire</p>
        <h1 className="mt-3 text-3xl font-black text-emerald-950">Une erreur est survenue.</h1>
        <p className="mt-4 leading-7 text-slate-600">Réessayez maintenant ou retournez à l’accueil si le problème continue.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="najah-button">Réessayer</button>
          <Link href="/" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 font-black text-slate-700 hover:bg-slate-50">Accueil</Link>
        </div>
      </section>
    </main>
  );
}
