"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const navigation = [
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
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
            {navigation.map((item) => {
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
            <Link href="/login" className="btn btn-outline hidden md:inline-flex">
              Log In
            </Link>
            <Link
              href="/signup"
              className="group hidden rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(59,130,246,0.6)] transition will-change-transform hover:-translate-y-0.5 hover:from-blue-500 hover:via-blue-500 hover:to-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 active:translate-y-px active:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.55)] motion-reduce:transition-none md:inline-flex"
            >
              Sign Up
            </Link>
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
            {navigation.map((item) => {
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
              <Link
                href="/login"
                className="rounded-full border border-white/15 bg-transparent px-4 py-2 text-center text-sm text-slate-200 transition hover:border-white/30 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_12px_24px_-10px_rgba(59,130,246,0.7)] transition hover:-translate-y-0.5 hover:from-blue-500 hover:via-blue-500 hover:to-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 active:translate-y-px active:shadow-[0_6px_16px_-6px_rgba(59,130,246,0.65)] motion-reduce:transition-none"
                onClick={() => setMobileOpen(false)}
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
