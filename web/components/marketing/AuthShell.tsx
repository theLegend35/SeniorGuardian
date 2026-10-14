import { Check } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Disclaimer } from "@/components/ui/primitives";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-950 px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="dot-grid absolute inset-0 opacity-[0.18] invert" aria-hidden />
        <div className="relative">
          <Logo inverse />
        </div>
        <div className="relative my-auto max-w-md py-16">
          <p className="text-[0.85rem] font-bold tracking-[0.14em] text-brand-200 uppercase">Senior Guardian</p>
          <h2 className="mt-4 text-[2.5rem] leading-[1.1] font-extrabold">Care between visits, explained in plain language.</h2>
          <ul className="mt-8 grid gap-4 text-[1.05rem] text-brand-50/90">
            {[
              "AI-powered answers come from your own saved record",
              "The original label stays beside every explanation",
              "You choose who sees what, and can change it any time",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-brand-500/30 text-brand-100">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative max-w-md text-[0.85rem] leading-relaxed text-brand-100/70">
          Informational only. Senior Guardian does not replace doctors, nurses, pharmacists, or emergency services. In an emergency, call 911.
        </p>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto w-full max-w-[30rem] flex-1 py-10 lg:flex lg:flex-col lg:justify-center">
          <h1 className="text-[2rem] leading-tight font-extrabold text-ink-950">{title}</h1>
          <p className="mt-2 text-[1.05rem] text-ink-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
        <Disclaimer compact className="mx-auto w-full max-w-[30rem] lg:hidden" />
      </main>
    </div>
  );
}
