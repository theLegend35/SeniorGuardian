import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Accessibility" };

export default function AccessibilityPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 pb-28 sm:py-16 sm:pb-28">
      <Logo />
      <p className="mt-8 text-[0.95rem] font-semibold text-brand-700">Accessibility</p>
      <h1 className="mt-1 text-[2.1rem] leading-tight font-extrabold text-ink-950">How to make this site easier to use</h1>
      <p className="mt-4 text-[1.05rem] leading-relaxed text-ink-600">
        The accessibility button at the bottom right changes text size and contrast on this browser. Quick assist, beside it, answers product questions. Inside a portal, the question mark opens a short how-to tour. A new account opens that tour on the first visit.
      </p>

      <section className="mt-8 grid gap-3">
        <h2 className="text-[1.25rem] font-extrabold text-ink-950">Text size</h2>
        <p className="text-[1.05rem] leading-relaxed text-ink-700">
          Default, Large, and Extra large change the size of type across the site. When you are signed in, the choice is saved with your account and matches Settings. When you are not signed in, it stays on this browser.
        </p>
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="text-[1.25rem] font-extrabold text-ink-950">High contrast</h2>
        <p className="text-[1.05rem] leading-relaxed text-ink-700">
          High contrast uses black text, a white page, and darker borders. It stays on this browser until you turn it off or choose Reset to defaults.
        </p>
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="text-[1.25rem] font-extrabold text-ink-950">Reading aloud</h2>
        <p className="text-[1.05rem] leading-relaxed text-ink-700">
          Where a page offers Speak, your browser reads that text aloud. The assistant can also take spoken questions.
        </p>
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="text-[1.25rem] font-extrabold text-ink-950">Type</h2>
        <p className="text-[1.05rem] leading-relaxed text-ink-700">
          Body text uses Manrope. The zero is a plain circle, so a time or a dose does not have a line through it.
        </p>
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="text-[1.25rem] font-extrabold text-ink-950">What this site will not do</h2>
        <p className="text-[1.05rem] leading-relaxed text-ink-700">
          Senior Guardian keeps a record and explains saved text in plain language. It does not replace a doctor, a pharmacist, or emergency services. In an emergency, call 911.
        </p>
      </section>

      <Link href="/" className="mt-10 inline-block font-bold text-brand-700 underline-offset-4 hover:underline">
        Back to the home page
      </Link>
    </main>
  );
}
