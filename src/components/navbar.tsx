"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, X, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useState } from "react";
import { useSession } from '@/lib/useSession';
import { useAuthOverlay } from './auth-overlay';

const baseNavigation = [
  { name: "Home", href: "/" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "Booking", href: "/booking" },
  { name: "AI Chatbot", href: "/chatbot" },
  { name: "Resources", href: "/resources" },
  { name: "Community", href: "/community" },
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Navbar() {
  const pathname = usePathname();
  // auth overlay control
  const { open } = useAuthOverlay();
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, signOut } = useSession();
  const [loggingOut,setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Profile info now comes straight from Google (NextAuth session)

  // Fetch profile (username & role) from Supabase when session present OR when a custom event announces update
  // No extra effect needed; session already holds name & (future) role.

  // Close menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest?.('[data-user-menu-root]')) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [userMenuOpen]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDark = useMemo(() => resolvedTheme === "dark", [resolvedTheme]);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <header className="sticky top-4 z-50 flex w-full justify-center px-4">
      <nav className="glass-panel w-full max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/40 p-2 text-slate-200 transition hover:border-white/30 hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/30 md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-100 transition hover:text-white"
            >
              <span className="rounded-full bg-blue-600/15 px-3 py-1 text-xs uppercase text-blue-400">
                WellnessAI
              </span>
            </Link>
          </div>

          <div className="hidden items-center gap-6 text-sm font-medium md:flex">
            {(session?.user.role === 'admin'
                ? [
                   { name:'Management', href:'/admin/management' },
                   { name:'Moderation', href:'/admin/moderation' },
                   { name:'Settings', href:'/admin/settings' }
                  ]
                : baseNavigation
            ).map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={classNames(
                    "relative text-slate-200 transition hover:text-white",
                    active && "text-white"
                  )}
                >
                  {item.name}
                  {active && (
                    <span className="absolute -bottom-2 left-0 h-0.5 w-full rounded-full bg-blue-500" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {!session && (
              <>
                <button type="button" onClick={()=>open('login')} className="btn btn-outline hidden md:inline-flex">Log In</button>
                <button type="button" onClick={()=>open('signup')} className="group hidden rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(59,130,246,0.6)] transition will-change-transform hover:-translate-y-0.5 hover:from-blue-500 hover:via-blue-500 hover:to-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 active:translate-y-px active:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.55)] motion-reduce:transition-none md:inline-flex">Sign Up</button>
              </>
            )}
            {session && (
              <div className="relative hidden md:flex" data-user-menu-root>
                <button
                  type="button"
                  onClick={()=> setUserMenuOpen(o=>!o)}
                  className={"group flex items-center gap-2 rounded-full border border-white/10 bg-black/30 pl-3 pr-2 py-1.5 text-xs text-slate-200 transition hover:border-white/25 " + (userMenuOpen ? 'border-blue-500/60' : '')}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                  <span className="font-semibold tracking-tight text-slate-100 max-w-[140px] truncate text-[13px]">{session.user.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{session.user.role}</span>
                  <ChevronDown size={14} className={`transition ${userMenuOpen? 'rotate-180':''}`} />
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur-xl"
                    >
                      <div className="flex items-center gap-3 px-3 py-3">
                        {session.user.avatarUrl ? (
                          <Image src={session.user.avatarUrl} alt={session.user.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-semibold text-white">
                            {session.user.name.slice(0,1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white leading-tight">{session.user.name}</p>
                          <p className="truncate text-[10px] uppercase tracking-[0.3em] text-slate-400">{session.user.role}</p>
                        </div>
                      </div>
                      <div className="my-1 h-px bg-white/10" />
                      <button
                        onClick={()=>{ setUserMenuOpen(false); window.location.href = '/profile'; }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5"
                        role="menuitem"
                      >
                        <span>Profile</span>
                      </button>
                      <div className="my-1 h-px bg-white/10" />
                      <button
                        type="button"
                        role="menuitem"
                        disabled={loggingOut}
                        onClick={async ()=>{ setLoggingOut(true); try { await signOut(); } finally { setLoggingOut(false); setUserMenuOpen(false);} }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
                      >
                        <span>{loggingOut? 'Logging out…' : 'Logout'}</span>
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-slate-100 transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-label="Toggle color theme"
            >
              {isMounted ? (
                isDark ? <Sun size={18} /> : <Moon size={18} />
              ) : (
                <Moon size={18} className="opacity-70" />
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="mt-4 flex flex-col gap-4 md:hidden">
            {(session?.user.role === 'admin'
              ? [
                  { name:'Management', href:'/admin/management' },
                  { name:'Moderation', href:'/admin/moderation' },
                  { name:'Settings', href:'/admin/settings' }
                ]
              : baseNavigation
            ).map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={classNames(
                    "rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:bg-black/20",
                    active && "border-blue-500/60 text-white"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
              {!session && (
                <>
                  <button type="button" className="rounded-full border border-white/15 bg-transparent px-4 py-2 text-center text-sm text-slate-200 transition hover:border-white/30 hover:text-white" onClick={()=>{ open('login'); setMobileOpen(false);} }>Log In</button>
                  <button type="button" className="rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_12px_24px_-10px_rgba(59,130,246,0.7)] transition hover:-translate-y-0.5 hover:from-blue-500 hover:via-blue-500 hover:to-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 active:translate-y-px active:shadow-[0_6px_16px_-6px_rgba(59,130,246,0.65)] motion-reduce:transition-none" onClick={()=>{ open('signup'); setMobileOpen(false);} }>Sign Up</button>
                </>
              )}
              {session && (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <div className="flex flex-col text-xs text-slate-200">
                      <span className="font-semibold text-white">{session.user.name}</span>
                      <span className="text-[10px] tracking-[0.3em] uppercase text-slate-400">user</span>
                    </div>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <button type="button" disabled={loggingOut} onClick={async ()=>{ setLoggingOut(true); try { await signOut(); } finally { setLoggingOut(false); setMobileOpen(false);} }} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">{loggingOut ? '...' : 'Logout'}</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
