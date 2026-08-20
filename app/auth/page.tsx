"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { NajahShell } from "@/components/NajahShell";
import { useAuth } from "@/lib/useAuth";

export default function AuthPage() {
  const router = useRouter();
  const { signUp, signIn, startLogin, resendVerification } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifiedMessage, setVerifiedMessage] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const result = mode === "signup" ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (result.error) return setError(result.error.message);
    if (mode === "signup") {
      setVerifiedMessage(true);
      setMessage("Un lien de vérification vient d’être envoyé à votre adresse e-mail.");
    } else {
      router.push("/onboarding");
    }
  };

  const resend = async () => {
    setError("");
    const result = await resendVerification(email);
    if (result.error) setError(result.error.message);
    else setMessage("Le lien de vérification a été renvoyé.");
  };

  return <NajahShell>
    <div className="moroccan-grid mx-auto grid max-w-5xl gap-8 rounded-[36px] p-5 md:grid-cols-[.9fr_1.1fr] md:p-8">
      <section className="hidden min-h-[550px] flex-col justify-between rounded-[30px] bg-emerald-950 p-8 text-white md:flex">
        <div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><Sparkles className="size-4 text-amber-300" />Apprendre avec méthode</span><h1 className="mt-8 text-4xl font-black leading-tight">Votre espace pour comprendre, pratiquer et réussir.</h1><p className="mt-5 max-w-sm leading-7 text-emerald-50/75">Importez vos cours, posez vos questions à l’assistant et entraînez-vous avec des quiz adaptés à votre niveau.</p></div>
        <div className="rounded-3xl border border-white/10 bg-white/10 p-5"><p className="text-sm font-bold text-amber-200">Confidentialité d’abord</p><p className="mt-2 text-sm leading-6 text-white/70">Votre parcours scolaire reste privé et personnalisable.</p></div>
      </section>
      <section className="najah-card p-6 sm:p-9">
        <div className="mb-7 flex gap-2 rounded-2xl bg-emerald-50 p-1"><button onClick={() => {setMode("signup"); setVerifiedMessage(false);}} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mode === "signup" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}>Créer un compte</button><button onClick={() => {setMode("login"); setVerifiedMessage(false);}} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mode === "login" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}>Se connecter</button></div>
        <p className="section-kicker">Bienvenue sur Najah.ma</p><h2 className="mt-2 text-3xl font-black text-emerald-950">{mode === "signup" ? "Commencez votre parcours." : "Ravi de vous revoir."}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{mode === "signup" ? "Créez votre compte élève avec votre adresse e-mail." : "Accédez à vos cours, vos quiz et votre progression."}</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block space-y-2 text-sm font-bold text-slate-700">Adresse e-mail<div className="relative"><Mail className="absolute left-4 top-3.5 size-5 text-slate-400" /><input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="najah-input pl-12" placeholder="vous@exemple.com" /></div></label>
          <label className="block space-y-2 text-sm font-bold text-slate-700">Mot de passe<div className="relative"><LockKeyhole className="absolute left-4 top-3.5 size-5 text-slate-400" /><input required minLength={6} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="najah-input px-12" placeholder="6 caractères minimum" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-2.5 rounded-lg p-1.5 text-slate-400">{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></div></label>
          <button disabled={busy} className="najah-button w-full disabled:opacity-50">{busy ? "Veuillez patienter…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}</button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />ou<span className="h-px flex-1 bg-slate-200" /></div>
        <button onClick={() => startLogin()} className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Continuer avec Google</button>
        {(message || verifiedMessage) && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="mr-2 inline size-5" />{message || "Vérifiez votre boîte de réception avant de continuer."}{verifiedMessage && <button onClick={resend} className="ml-2 underline">Renvoyer</button>}</div>}
        {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        <p className="mt-6 text-center text-xs text-slate-500">En continuant, vous acceptez les conditions de Najah.ma.</p>
        <Link href="/" className="mt-5 block text-center text-sm font-bold text-emerald-800">Retour à l’accueil</Link>
      </section>
    </div>
  </NajahShell>;
}
