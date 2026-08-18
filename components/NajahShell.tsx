"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { LibraryBig, LogOut, UsersRound, BrainCircuit, ChartNoAxesCombined } from "lucide-react";

const navItems = [
  { href: "/archive", label: "الأرشيف", icon: LibraryBig },
  { href: "/rooms", label: "غرف المراجعة", icon: UsersRound },
  { href: "/copilot", label: "المساعد الذكي", icon: BrainCircuit },
  { href: "/quizzes", label: "اختبارات MCQ", icon: BrainCircuit },
  { href: "/dashboard", label: "لوحتي", icon: ChartNoAxesCombined },
];

export function NajahShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, startLogin, signOut, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-black text-emerald-950">
            Najah<span className="text-amber-600">.ma</span>
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-emerald-900">
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          {!loading && (
            isAuthenticated ? (
              <button onClick={() => signOut()} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-red-700">
                <LogOut className="size-4" />
                خروج
              </button>
            ) : (
              <button onClick={() => startLogin()} className="rounded-xl bg-emerald-900 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                دخول التلميذ
              </button>
            )
          )}
        </div>
        <nav className="flex items-center gap-4 overflow-x-auto border-t border-emerald-950/5 px-5 py-2 md:hidden">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-600">
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
