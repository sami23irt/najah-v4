"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Archive, BrainCircuit, ChartNoAxesCombined, FileQuestion, LogIn, LogOut, Sparkles, UsersRound } from "lucide-react";

const navItems = [
  { href: "/archive", label: "Archives", icon: Archive },
  { href: "/study", label: "Ma séance", icon: Sparkles },
  { href: "/copilot", label: "Assistant IA", icon: BrainCircuit },
  { href: "/quizzes", label: "Quiz", icon: FileQuestion },
  { href: "/rooms", label: "Salles", icon: UsersRound },
  { href: "/dashboard", label: "Mon espace", icon: ChartNoAxesCombined },
];

export function NajahShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, startLogin, signOut, loading, user } = useAuth();
  const pathname = usePathname();

  return (
    <div className="najah-shell min-h-screen">
      <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Najah.ma — Accueil">
            <Image src="/assets/najah-logo.png" alt="" width={44} height={44} priority className="size-11 object-contain" />
            <span className="text-2xl font-black tracking-tight text-emerald-950">Najah<span className="text-amber-600">.ma</span></span>
          </Link>
          <nav aria-label="Navigation principale" className="hidden items-center gap-5 lg:flex">
            {navItems.map(item => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold transition ${active ? "bg-emerald-50 text-emerald-900" : "text-slate-600 hover:text-emerald-900"}`}>
                <item.icon className="size-4" />{item.label}
              </Link>;
            })}
          </nav>
          {!loading && (isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block"><p className="text-xs font-black text-emerald-950">Espace élève</p><p className="max-w-32 truncate text-[11px] text-slate-500">{user?.email}</p></div>
              <button onClick={() => signOut()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:border-red-200 hover:text-red-700"><LogOut className="size-4" />Se déconnecter</button>
            </div>
          ) : <Link href="/auth" className="najah-button px-4 py-2.5 text-sm"><LogIn className="size-4" />Se connecter</Link>)}
        </div>
        <nav aria-label="Navigation secondaire" className="flex gap-2 overflow-x-auto border-t border-emerald-950/5 px-5 py-2 lg:hidden">
          {navItems.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined} className="flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-600"><item.icon className="size-4" />{item.label}</Link>)}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-8">{children}</main>
      <footer aria-label="Pied de page" className="mx-auto mt-12 flex max-w-7xl items-center justify-between border-t border-emerald-950/10 px-5 py-6 text-xs text-slate-500"><span>© 2026 Najah.ma</span><span>Réviser mieux. Progresser ensemble.</span></footer>
    </div>
  );
}
