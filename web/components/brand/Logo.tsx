import Link from "next/link";

import { cx } from "@/components/ui/primitives";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cx("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="13" fill="#0b564e" />
      <circle cx="15.5" cy="14.5" r="2.7" fill="#fff" />
      <path d="M9.2 28.6c.7-4.8 3.1-7.4 6.3-7.4s5.6 2.6 6.3 7.4" fill="none" stroke="#fff" strokeWidth="2.15" strokeLinecap="round" />
      <circle cx="26.2" cy="16.2" r="2.45" fill="#f39a55" />
      <path d="M20.4 29.2c.7-4.2 2.8-6.5 5.8-6.5s5.1 2.3 5.8 6.5" fill="none" stroke="#f39a55" strokeWidth="2.15" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", inverse, compact, className }: { href?: string; inverse?: boolean; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex shrink-0 items-center gap-2 sm:gap-2.5", className)} aria-label="Senior Guardian home">
      <LogoMark className="size-8 sm:size-9" />
      <span className={cx("font-display text-[0.95rem] font-extrabold tracking-tight whitespace-nowrap sm:text-[1.05rem]", inverse ? "text-white" : "text-ink-950", compact && "max-sm:sr-only")}>
        Senior Guardian
      </span>
    </Link>
  );
}
