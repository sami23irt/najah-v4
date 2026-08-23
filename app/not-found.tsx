import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";

export default function NotFound() {
  return (
    <NajahShell>
      <section className="najah-card mx-auto max-w-2xl px-6 py-16 text-center sm:px-10">
        <Compass className="mx-auto size-12 text-amber-600" aria-hidden="true" />
        <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-amber-700">Erreur 404</p>
        <h1 className="mt-3 text-4xl font-black text-emerald-950">Cette page est introuvable.</h1>
        <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-600">
          Le lien est peut-être ancien ou l’adresse a été saisie incorrectement. Retournez à l’accueil pour continuer votre révision.
        </p>
        <Link href="/" className="najah-button mt-8" aria-label="Retourner à la page d’accueil">
          Retour à l’accueil <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </NajahShell>
  );
}
