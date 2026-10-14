"use client";

import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { buttonClass, cx } from "@/components/ui/primitives";

const NAV = [
  ["Features", "#features", "features"],
  ["Devices", "#devices", "devices"],
  ["Safety", "#safety", "safety"],
  ["Sharing", "#people", "people"],
  ["FAQ", "#faq", "faq"],
] as const;

export function MarketingHeader({ portal }: { portal: string | null }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-40 transition-colors",
        solid ? "border-b border-line bg-white shadow-[0_8px_30px_-24px_rgb(11_86_78/0.45)]" : "border-b border-transparent bg-canvas",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-8">
        <Logo compact />
        <nav aria-label="Primary" className="hidden items-center gap-0.5 xl:flex">
          {NAV.map(([label, href, tour]) => (
            <a
              key={href}
              href={href}
              data-tour={tour}
              className="rounded-lg px-3 py-2 text-[0.95rem] font-semibold text-ink-700 hover:bg-sand hover:text-ink-950"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {portal ? (
            <Link href={portal} className={cx(buttonClass("primary", "sm"), "px-3 sm:px-3.5")}>
              <span className="hidden sm:inline">Open my portal</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-[0.95rem] font-semibold text-ink-700 hover:text-ink-950 sm:block">
                Sign in
              </Link>
              <Link href="/signup" data-tour="signup" className={cx(buttonClass("primary", "sm"), "rounded-full")}>
                Create account
              </Link>
            </>
          )}
          <details className="relative xl:hidden">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl text-ink-800 hover:bg-sand">
              <Menu className="size-6" aria-hidden />
              <span className="sr-only">Open menu</span>
            </summary>
            <nav aria-label="Mobile" className="absolute right-0 top-12 z-40 w-56 rounded-2xl border border-line bg-white p-2 shadow-float">
              {NAV.map(([label, href, tour]) => (
                <a key={href} href={href} data-tour={tour} className="block rounded-xl px-3 py-3 text-[1rem] font-semibold text-ink-800 hover:bg-sand">
                  {label}
                </a>
              ))}
              {portal ? null : (
                <Link href="/login" className="block rounded-xl px-3 py-3 text-[1rem] font-semibold text-ink-800 hover:bg-sand sm:hidden">
                  Sign in
                </Link>
              )}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
