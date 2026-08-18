import Link from "next/link";
import { NajahShell } from "@/components/NajahShell";
import { LibraryBig, BrainCircuit, UsersRound } from "lucide-react";

export default function HomePage() {
  return (
    <NajahShell>
      <section className="mx-auto max-w-3xl text-center">
        <p className="section-kicker">Najah.ma</p>
        <h1 className="mt-3 text-5xl font-black leading-tight text-emerald-950">استعد لامتحاناتك في مكان واحد.</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">أرشيف الامتحانات الرسمية، مساعد ذكي مرتبط بالمقرر المغربي، وغرف مذاكرة جماعية بالفيديو.</p>
      </section>
      <section className="mt-12 grid gap-5 md:grid-cols-3">
        <FeatureCard href="/archive" icon={LibraryBig} title="أرشيف الامتحانات" desc="بحث متعدد الفلاتر مع قارئ مزدوج للموضوع والتصحيح." />
        <FeatureCard href="/copilot" icon={BrainCircuit} title="المساعد الذكي" desc="إجابات مبنية على قاعدة معرفة رسمية، لا اختلاق." />
        <FeatureCard href="/rooms" icon={UsersRound} title="غرف المذاكرة" desc="فيديو وصوت مباشر مع مؤقت بومودورو متزامن." />
      </section>
    </NajahShell>
  );
}

function FeatureCard({ href, icon: Icon, title, desc }: { href: string; icon: typeof LibraryBig; title: string; desc: string }) {
  return (
    <Link href={href} className="rounded-3xl border border-emerald-950/10 bg-white p-6 hover:shadow-md">
      <Icon className="size-8 text-emerald-700" />
      <h2 className="mt-4 text-lg font-black text-emerald-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
    </Link>
  );
}
