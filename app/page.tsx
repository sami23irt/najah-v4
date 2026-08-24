import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArrowRight, BrainCircuit, FileUp, PlayCircle, Sparkles, UsersRound } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";

export const metadata: Metadata = {
  title: "Plateforme de révision pour les élèves marocains",
  description: "Révisez les examens marocains, transformez vos cours en résumés et entraînez-vous avec des quiz intelligents sur Najah.ma.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Najah.ma — Révisez mieux, réussissez avec confiance",
    description: "Une plateforme marocaine pour réviser, comprendre et progresser.",
    url: "/",
  },
};

export default function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://najah.ma";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Najah.ma",
    url: siteUrl,
    description: "Une plateforme marocaine pour réviser, comprendre et progresser.",
    inLanguage: "fr-MA",
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <NajahShell>
    <section className="moroccan-grid overflow-hidden rounded-[36px] bg-emerald-950 px-7 py-12 text-white md:px-14 md:py-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_.8fr]">
        <div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-amber-200"><Sparkles className="size-4" />La révision devient plus simple</span><h1 className="mt-7 max-w-3xl text-5xl font-black leading-[1.08] tracking-tight md:text-7xl">Comprendre. Pratiquer. <span className="text-amber-300">Réussir.</span></h1><p className="mt-6 max-w-xl text-lg leading-8 text-emerald-50/75">Najah.ma rassemble vos examens, vos cours et vos outils intelligents dans un espace pensé pour les élèves marocains.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/auth" className="najah-button-gold"><ArrowRight className="size-5" />Commencer gratuitement</Link><Link href="/study" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-5 py-3 font-black text-white hover:bg-white/10"><PlayCircle className="size-5" />Voir l’espace de révision</Link></div></div>
        <div className="relative"><div className="absolute -inset-5 rounded-full bg-amber-300/10 blur-3xl" /><div className="relative rounded-[32px] border border-white/10 bg-white/10 p-5 backdrop-blur"><div className="rounded-3xl bg-white p-5 text-emerald-950 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500">Votre prochaine étape</p><p className="mt-1 text-xl font-black">Importer un cours</p></div><div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><FileUp /></div></div><div className="mt-6 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 p-7 text-center"><FileUp className="mx-auto size-9 text-emerald-700" /><p className="mt-3 font-black">PDF ou lien YouTube</p><p className="mt-1 text-xs text-slate-500">Un résumé et un quiz en quelques instants</p></div><div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold"><div className="rounded-xl bg-slate-50 p-3">Résumé</div><div className="rounded-xl bg-slate-50 p-3">Assistant</div><div className="rounded-xl bg-amber-50 p-3 text-amber-800">Quiz</div></div></div></div></div>
      </div>
    </section>
    <section className="mt-10 grid gap-5 md:grid-cols-3"><FeatureCard href="/archive" icon={Archive} title="Archives ciblées" desc="Choisissez votre niveau et votre filière. Les examens affichés restent pertinents." /><FeatureCard href="/study" icon={BrainCircuit} title="Cours transformés" desc="Importez un PDF ou une vidéo YouTube pour obtenir un résumé et poser vos questions." /><FeatureCard href="/rooms" icon={UsersRound} title="Réviser ensemble" desc="Rejoignez une salle de concentration et gardez votre rythme avec les autres élèves." /></section>
    <section className="mt-10 grid gap-5 rounded-[30px] border border-emerald-950/10 bg-white p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10"><div><p className="section-kicker">Votre parcours</p><h2 className="mt-2 text-3xl font-black text-emerald-950">Un espace adapté à votre niveau.</h2><p className="mt-3 max-w-2xl leading-7 text-slate-600">Après votre inscription, indiquez votre niveau et votre filière. Najah.ma filtre automatiquement les archives et personnalise vos outils de révision.</p></div><Link href="/auth" className="najah-button whitespace-nowrap">Créer mon espace <ArrowRight className="size-4" /></Link></section>
    </NajahShell>
  </>;
}

function FeatureCard({ href, icon: Icon, title, desc }: { href: string; icon: typeof Archive; title: string; desc: string }) {
  return <Link href={href} className="najah-card block p-6 transition hover:-translate-y-1 hover:shadow-xl"><Icon className="size-8 text-emerald-700" /><h2 className="mt-5 text-xl font-black text-emerald-950">{title}</h2><p className="mt-2 leading-7 text-slate-600">{desc}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-800">Découvrir <ArrowRight className="size-4" /></span></Link>;
}
