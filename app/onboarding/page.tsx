"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Check, GraduationCap, MapPin, Sparkles } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

const levels = [
  { value: "3AC", label: "3e année collège", caption: "Préparer le brevet" },
  { value: "TRC", label: "Tronc commun", caption: "Construire les bases" },
  { value: "1BAC", label: "1ère année bac", caption: "Progresser sereinement" },
  { value: "2BAC", label: "2e année bac", caption: "Réussir le baccalauréat" },
];
const tracks = ["Sciences mathématiques", "Sciences physiques", "Sciences de la vie et de la terre", "Lettres et sciences humaines"];
const regions = ["Rabat-Salé-Kénitra", "Casablanca-Settat", "Fès-Meknès", "Marrakech-Safi", "Tanger-Tétouan-Al Hoceïma", "Autre"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, startLogin } = useAuth();
  const supabase = createBrowserSupabaseClient();
  const [level, setLevel] = useState("2BAC");
  const [track, setTrack] = useState("Sciences mathématiques");
  const [region, setRegion] = useState("Rabat-Salé-Kénitra");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!user) return;
    setSaving(true); setError("");
    const { error: saveError } = await supabase.from("student_profiles").upsert({ user_id: user.id, level, track, region, preferred_locale: "fr" });
    setSaving(false);
    if (saveError) return setError(saveError.message);
    router.push("/study");
  };

  if (loading) return <NajahShell><div className="najah-card mx-auto max-w-xl p-12 text-center"><Sparkles className="mx-auto size-10 animate-pulse text-emerald-700" /><p className="mt-4 font-bold text-slate-600">Préparation de votre espace…</p></div></NajahShell>;

  if (!isAuthenticated) return <NajahShell><div className="najah-card mx-auto max-w-xl p-12 text-center"><Sparkles className="mx-auto size-10 text-emerald-700" /><p className="mt-4 font-bold text-slate-600">Connectez-vous pour préparer votre espace.</p><button onClick={startLogin} className="najah-button mt-6">Se connecter avec Google</button></div></NajahShell>;

  return <NajahShell>
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-center gap-3 text-xs font-black text-emerald-900"><span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-emerald-900 text-white">1</span>Vérification</span><span className="h-px w-16 bg-emerald-200" /><span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-emerald-900 text-white">2</span>Votre niveau</span><span className="h-px w-16 bg-emerald-200" /><span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full border border-emerald-200 bg-white">3</span>Votre espace</span></div>
      <section className="najah-card overflow-hidden md:grid md:grid-cols-[.8fr_1.2fr]">
        <div className="moroccan-grid bg-emerald-950 p-8 text-white md:p-10"><GraduationCap className="size-12 text-amber-300" /><h1 className="mt-8 text-4xl font-black leading-tight">Un espace qui vous ressemble.</h1><p className="mt-4 leading-7 text-emerald-50/75">Votre niveau nous aide à afficher les bons examens, les bons cours et des quiz adaptés.</p><div className="mt-10 space-y-4 text-sm font-bold text-white/80"><p><BookOpenCheck className="mr-2 inline size-5 text-amber-300" />Archives filtrées automatiquement</p><p><Sparkles className="mr-2 inline size-5 text-amber-300" />Assistant aligné sur votre parcours</p></div></div>
        <div className="p-7 md:p-10"><p className="section-kicker">Dernière étape</p><h2 className="mt-2 text-3xl font-black text-emerald-950">Quel est votre parcours scolaire ?</h2><p className="mt-3 text-sm leading-6 text-slate-500">Vous pourrez modifier ces informations dans votre profil.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">{levels.map(item => <button key={item.value} onClick={() => setLevel(item.value)} className={`rounded-2xl border p-4 text-left transition ${level === item.value ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10" : "border-slate-200 hover:border-emerald-300"}`}><span className="flex items-center justify-between font-black text-emerald-950">{item.label}{level === item.value && <Check className="size-5 text-emerald-700" />}</span><span className="mt-1 block text-xs text-slate-500">{item.caption}</span></button>)}</div>
          <label className="mt-6 block space-y-2 text-sm font-bold text-slate-700">Filière<select value={track} onChange={e => setTrack(e.target.value)} className="najah-input"><option value="">Choisir une filière</option>{tracks.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="mt-4 block space-y-2 text-sm font-bold text-slate-700"><MapPin className="mr-1 inline size-4 text-emerald-700" />Académie / région<select value={region} onChange={e => setRegion(e.target.value)} className="najah-input"><option value="">Choisir une région</option>{regions.map(item => <option key={item}>{item}</option>)}</select></label>
          <button onClick={save} disabled={!track || !region || saving} className="najah-button mt-7 w-full disabled:opacity-50">{saving ? "Enregistrement…" : "Entrer dans mon espace"}</button>{error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        </div>
      </section>
    </div>
  </NajahShell>;
}
