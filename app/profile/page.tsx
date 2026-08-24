"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Trash2, UserRoundCog } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

const levels = [
  { value: "3AC", label: "3e année collège" },
  { value: "TRC", label: "Tronc commun" },
  { value: "1BAC", label: "1ère année bac" },
  { value: "2BAC", label: "2e année bac" },
];
const tracks = ["Sciences mathématiques", "Sciences physiques", "Sciences de la vie et de la terre", "Lettres et sciences humaines"];
const regions = ["Rabat-Salé-Kénitra", "Casablanca-Settat", "Fès-Meknès", "Marrakech-Safi", "Tanger-Tétouan-Al Hoceïma", "Autre"];

export default function ProfilePage() {
  const { isAuthenticated, user } = useAuth();
  const supabase = createBrowserSupabaseClient();
  const [level, setLevel] = useState("2BAC");
  const [track, setTrack] = useState("");
  const [region, setRegion] = useState("");
  const [pseudonym, setPseudonym] = useState("");
  const [showPseudonym, setShow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("student_profiles")
      .select("level,track,region,pseudonym,show_pseudonym")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setLevel(data.level ?? "2BAC");
        setTrack(data.track ?? "");
        setRegion(data.region ?? "");
        setPseudonym(data.pseudonym ?? "");
        setShow(data.show_pseudonym ?? true);
      });
  }, [supabase, user]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setError("");
    const { error: saveError } = await supabase.from("student_profiles").upsert({
      user_id: user.id,
      level,
      track,
      region,
      pseudonym: pseudonym || null,
      show_pseudonym: showPseudonym,
      preferred_locale: "fr",
    });
    setSaving(false);
    if (saveError) setError("Impossible d’enregistrer le profil pour le moment.");
    else setSaved(true);
  };

  const deleteAccount = async () => {
    if (!window.confirm("Cette action supprime définitivement votre compte. Continuer ?")) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" } });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "La suppression a échoué.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La suppression a échoué.");
      setDeleting(false);
    }
  };

  if (!isAuthenticated) {
    return <NajahShell><div className="najah-card mx-auto max-w-xl p-12 text-center"><UserRoundCog className="mx-auto size-12 text-emerald-700" aria-hidden="true" /><h1 className="mt-5 text-2xl font-black text-emerald-950">Votre profil scolaire</h1><Link href="/auth" className="najah-button mt-6">Se connecter</Link></div></NajahShell>;
  }

  return <NajahShell>
    <section aria-labelledby="profile-title"><p className="section-kicker">Mon profil</p><h1 id="profile-title" className="mt-2 text-4xl font-black text-emerald-950">Personnalisez votre espace.</h1><p className="mt-3 text-slate-600">Ces informations servent à filtrer vos archives et adapter vos révisions.</p></section>
    <form onSubmit={save} className="najah-card mt-8 max-w-3xl p-7" aria-describedby={error ? "profile-error" : undefined}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-bold">Niveau<select value={level} onChange={e => setLevel(e.target.value)} className="najah-input">{levels.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="space-y-2 text-sm font-bold">Filière<select value={track} onChange={e => setTrack(e.target.value)} className="najah-input"><option value="">Choisir</option>{tracks.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="space-y-2 text-sm font-bold sm:col-span-2">Académie / région<select value={region} onChange={e => setRegion(e.target.value)} className="najah-input"><option value="">Choisir</option>{regions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="space-y-2 text-sm font-bold">Nom public<input value={pseudonym} onChange={e => setPseudonym(e.target.value)} className="najah-input" placeholder="Optionnel" /></label>
      </div>
      <label className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950">Afficher mon nom public dans le classement<input type="checkbox" checked={showPseudonym} onChange={e => setShow(e.target.checked)} className="size-5 accent-emerald-700" /></label>
      <button type="submit" disabled={!track || !region || saving} className="najah-button mt-6 w-full disabled:opacity-50">{saving ? "Enregistrement…" : <><CheckCircle2 className="size-4" aria-hidden="true" />Enregistrer mon profil</>}</button>
      {saved && <p className="mt-4 text-center text-sm font-bold text-emerald-700" role="status">Profil enregistré.</p>}
      {error && <p id="profile-error" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
    </form>
    <section className="mt-6 max-w-3xl rounded-[28px] border border-red-200 bg-red-50 p-6" aria-labelledby="delete-account-title"><h2 id="delete-account-title" className="font-black text-red-950">Supprimer mon compte</h2><p className="mt-2 text-sm leading-6 text-red-900/75">Cette action supprime définitivement votre compte et les données associées.</p><button type="button" onClick={deleteAccount} disabled={deleting} className="mt-4 flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 font-bold text-white disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" />{deleting ? "Suppression…" : "Supprimer mon compte"}</button></section>
  </NajahShell>;
}
