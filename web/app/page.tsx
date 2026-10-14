import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Eye, HeartPulse, Phone, Pill, ShieldCheck, Star, Watch, type LucideIcon } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { DayShowcase } from "@/components/marketing/DayShowcase";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Reveal } from "@/components/marketing/Reveal";
import { ShareDemo } from "@/components/marketing/ShareDemo";
import { cx } from "@/components/ui/primitives";
import { homeFor } from "@/lib/auth/access";
import { currentActor } from "@/lib/auth/session";

const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const MARQUEE = ["Medicines", "Appointments", "Check a Health Concern", "Ring and watch readings", "Family sharing", "Care nearby", "Plain-language explanations"];

function RingMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

const PROVIDERS: Array<{ name: string; line: string; icon: LucideIcon | null }> = [
  { name: "Google Health", line: "Fitbit and Pixel Watch", icon: HeartPulse },
  { name: "Oura", line: "Oura Ring", icon: null },
  { name: "Withings", line: "ScanWatch, scale, blood pressure", icon: Watch },
];

const FAQ = [
  { q: "Is Senior Guardian a doctor?", a: "No. It organizes what you save and explains it in plain language. It does not diagnose, prescribe, or replace your doctor or a call to 911." },
  { q: "Can the assistant change a medicine?", a: "No. The prescription text you saved stays on screen. The assistant cannot add a dose or rewrite that text." },
  { q: "Who can see my record?", a: "Only people you authorize, and only the sections you turn on. Turning a switch off closes that section right away." },
  { q: "What happens if I describe an emergency?", a: "The chat stops and tells you to call 911." },
  { q: "Which rings and watches work?", a: "Oura and Withings sign in through their own accounts. Fitbit and Pixel Watch use Google Health. If a device stops sending numbers, the record says it is offline." },
];

const SERIF_H2 = "font-serif text-[clamp(2.5rem,5vw,4.2rem)] leading-[0.98] font-normal text-ink-950";

export default async function HomePage() {
  const actor = await currentActor();
  const portal = actor ? homeFor(actor.role) : null;

  return (
    <div className={cx("overflow-x-clip bg-canvas text-ink-800", instrument.variable)}>
      <MarketingHeader portal={portal} />
      <main>
        <section className="relative pt-24 sm:pt-28">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-24">
            <div>
              <p className="hero-rise inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 font-display text-[0.85rem] font-bold text-ink-700">
                <span className="size-2 rounded-full bg-apricot-500" />
                For older adults, the family who helps, and their clinicians
              </p>
              <h1 className="mt-6 font-serif text-[clamp(3.1rem,7.2vw,6.4rem)] leading-[0.92] font-normal text-ink-950">
                <span className="hero-rise block" style={{ animationDelay: "80ms" }}>
                  Health at home,
                </span>
                <span className="hero-rise block text-brand-700 italic" style={{ animationDelay: "160ms" }}>
                  kept in one
                </span>
                <span className="hero-rise block text-brand-700 italic" style={{ animationDelay: "240ms" }}>
                  calm place.
                </span>
              </h1>
              <p className="hero-rise mt-7 max-w-xl text-[1.15rem] leading-relaxed text-ink-600 sm:text-[1.25rem]" style={{ animationDelay: "320ms" }}>
                Medicines, visits, health concerns, and ring readings live together. Senior Guardian explains them in plain words and shares only what you choose.
              </p>
              <div className="hero-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "400ms" }}>
                <Link
                  href="/signup"
                  className="group inline-flex min-h-14 items-center gap-2 rounded-full bg-apricot-500 px-7 text-[1.08rem] font-bold text-ink-950 shadow-[0_14px_30px_-12px_rgb(229_127_51/0.8)] transition-transform hover:-translate-y-0.5 hover:bg-apricot-400"
                >
                  Create account
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                <a href="#features" className="inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-ink-950 px-6 text-[1.05rem] font-bold text-ink-950 transition-colors hover:bg-ink-950 hover:text-white">
                  See a day
                </a>
              </div>
              <ul className="hero-rise mt-9 grid gap-2.5 sm:grid-cols-3 sm:gap-4" style={{ animationDelay: "480ms" }}>
                {["The original words stay visible", "Nothing shared until you say so", "Emergency words point to 911"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[0.95rem] font-semibold text-ink-700">
                    <Check className="mt-0.5 size-4 flex-none text-brand-600" strokeWidth={3} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-[30rem] lg:max-w-none">
              <div className="arch-in relative ml-auto aspect-[4/5] w-[86%] overflow-hidden rounded-t-full rounded-b-[2rem] bg-ink-950">
                <img
                  src="/marketing/hero-window.jpg"
                  alt="An older woman sits beside an open window in daylight, looking outside."
                  className="hero-ken size-full object-cover"
                  style={{ objectPosition: "40% center" }}
                />
              </div>
              <div className="hero-rise absolute bottom-[-1.5rem] left-0 size-[38%] overflow-hidden rounded-full border-[7px] border-canvas shadow-float" style={{ animationDelay: "650ms" }}>
                <img src="/marketing/hero-still.jpg" alt="A pill organizer and a glass of water on a sunlit table." className="size-full object-cover" />
              </div>

              <div className="hero-rise absolute top-[14%] left-[-2%] sm:left-[-6%]" style={{ animationDelay: "800ms" }}>
                <div className="float-y flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-float">
                  <span className="grid size-10 place-items-center rounded-full bg-brand-600 text-white">
                    <Check className="size-5" strokeWidth={3} aria-hidden />
                  </span>
                  <span>
                    <span className="block font-display text-[0.95rem] font-extrabold text-ink-950">Lisinopril 10 mg</span>
                    <span className="block text-[0.82rem] text-ink-500">8:00 AM · Taken</span>
                  </span>
                </div>
              </div>
              <div className="hero-rise absolute top-[56%] right-[-2%] sm:right-[-5%]" style={{ animationDelay: "1000ms" }}>
                <div className="float-y flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-float" style={{ animationDelay: "-2s" }}>
                  <span className="grid size-10 place-items-center rounded-full bg-sand text-ink-600">
                    <Watch className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-display text-[0.95rem] font-extrabold text-ink-950">Oura Ring</span>
                    <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-500">
                      <span className="size-1.5 rounded-full bg-brand-500" /> On
                    </span>
                  </span>
                </div>
              </div>
              <div className="hero-rise absolute top-[2%] right-[-2%] sm:right-[-4%]" style={{ animationDelay: "1200ms" }}>
                <div className="float-y flex items-center gap-2.5 rounded-full bg-ink-950 py-2 pr-4 pl-2 text-white shadow-float" style={{ animationDelay: "-4s" }}>
                  <span className="grid size-8 place-items-center rounded-full bg-apricot-500 text-ink-950">
                    <Eye className="size-4" aria-hidden />
                  </span>
                  <span className="text-[0.9rem] font-semibold">Helen can see Medicines</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="marquee overflow-hidden border-y border-brand-900 bg-brand-950 py-5 text-white" aria-hidden>
          <div className="marquee-track flex w-max">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center">
                {MARQUEE.map((word) => (
                  <span key={word} className="flex items-center">
                    <span className="px-7 font-serif text-[clamp(1.6rem,2.6vw,2.3rem)] whitespace-nowrap italic">{word}</span>
                    <Star className="size-4 flex-none fill-apricot-400 text-apricot-400" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section id="features" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="mb-12 grid gap-4 lg:grid-cols-2 lg:items-end">
              <h2 className={SERIF_H2}>
                From the first pill <span className="text-apricot-500 italic">to the last reading.</span>
              </h2>
              <p className="max-w-lg text-[1.12rem] leading-relaxed text-ink-600 lg:justify-self-end">
                Follow Eleanor through one day. Pick a moment, or let it play.
              </p>
            </Reveal>
            <DayShowcase />
          </div>
        </section>

        <section id="devices" className="relative scroll-mt-20 overflow-hidden bg-brand-950 py-20 text-white sm:py-28">
          <div className="drift pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
            <Reveal>
              <p className="font-display text-[0.85rem] font-extrabold tracking-[0.16em] text-apricot-400 uppercase">Rings and watches</p>
              <h2 className="mt-4 font-serif text-[clamp(2.5rem,5vw,4.2rem)] leading-[0.98] font-normal">
                Connect the device <span className="text-apricot-400 italic">you already wear.</span>
              </h2>
              <p className="mt-5 max-w-lg text-[1.1rem] leading-relaxed text-white/75">
                Readings arrive on their own. If one falls outside the range you saved, the patient, the family member, and the clinician each get an alert.
              </p>
              <ul className="mt-8 grid gap-3">
                {PROVIDERS.map((provider) => (
                  <li key={provider.name} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 transition-colors hover:bg-white/10">
                    <span className="grid size-11 flex-none place-items-center rounded-xl bg-white text-brand-900">
                      {provider.icon ? <provider.icon className="size-6" aria-hidden /> : <RingMark className="size-6" />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-[1.05rem] font-extrabold">{provider.name}</span>
                      <span className="block text-[0.92rem] text-white/65">{provider.line}</span>
                    </span>
                    <Check className="size-5 text-apricot-400" strokeWidth={3} aria-hidden />
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={120}>
              <div className="relative mx-auto grid aspect-square w-full max-w-[28rem] place-items-center">
                <div className="spin-slow absolute inset-0 rounded-full border-2 border-dashed border-white/15" />
                <div className="absolute inset-[9%] rounded-full border border-white/10" />
                <div className="spin-slow absolute inset-[9%]" style={{ animationDuration: "16s", animationDirection: "reverse" }}>
                  <span className="absolute top-0 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-apricot-400 shadow-[0_0_24px_rgb(243_154_85/0.9)]" />
                </div>
                <div className="absolute inset-[20%] rounded-full bg-gradient-to-br from-brand-700 to-brand-900 shadow-[inset_0_2px_30px_rgb(0_0_0/0.35)]" />
                <div className="relative text-center">
                  <p className="font-display text-[0.78rem] font-extrabold tracking-[0.16em] text-white/60 uppercase">Heart rate</p>
                  <p className="mt-1 font-display text-[clamp(3.4rem,8vw,4.8rem)] leading-none font-extrabold">112</p>
                  <p className="font-display text-[1rem] font-bold text-white/70">bpm</p>
                  <p className="mt-3 inline-flex rounded-full bg-apricot-500 px-3 py-1 font-display text-[0.82rem] font-extrabold text-ink-950">Outside 50–100</p>
                </div>
                <div className="float-y absolute right-0 bottom-[8%] rounded-2xl bg-white px-4 py-3 text-ink-950 shadow-float">
                  <p className="flex items-center gap-1.5 font-display text-[0.9rem] font-extrabold">
                    <span className="size-2 rounded-full bg-brand-500" /> On
                  </p>
                  <p className="text-[0.8rem] text-ink-500">Latest numbers showing</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="safety" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="mb-12 max-w-3xl">
              <h2 className={SERIF_H2}>
                Explanations help. <span className="text-apricot-500 italic">The original always stays.</span>
              </h2>
            </Reveal>
            <div className="grid gap-4 lg:grid-cols-6 lg:grid-rows-[auto_auto]">
              <Reveal className="lg:col-span-4 lg:row-span-2">
                <figure className="group relative h-full min-h-[22rem] overflow-hidden rounded-[2rem] bg-ink-950">
                  <img src="/marketing/hero-listen.jpg" alt="An older man talks with a woman at a desk beside a computer." className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                    <p className="max-w-md font-serif text-[clamp(1.9rem,3.4vw,2.8rem)] leading-[1.02]">The questions you wrote wait on the appointment.</p>
                    <p className="mt-2 max-w-md text-white/80">A clinician sees them only after you share that part of the record.</p>
                  </figcaption>
                </figure>
              </Reveal>
              <Reveal className="lg:col-span-2" delay={80}>
                <div className="h-full rounded-[2rem] border border-line bg-white p-5">
                  <p className="font-display text-[0.72rem] font-extrabold tracking-[0.12em] text-ink-500 uppercase">Original prescription</p>
                  <p className="mt-1.5 font-semibold text-ink-950">Take one 10 mg tablet by mouth every morning.</p>
                  <div className="my-4 h-px bg-line" />
                  <p className="font-display text-[0.72rem] font-extrabold tracking-[0.12em] text-ai-700 uppercase">AI-powered explanation</p>
                  <p className="mt-1.5 text-ink-700">One tablet each morning, about the same time, until your clinician says otherwise.</p>
                </div>
              </Reveal>
              <Reveal className="lg:col-span-2" delay={140}>
                <div className="flex h-full flex-col justify-between gap-6 rounded-[2rem] bg-apricot-500 p-6 text-ink-950">
                  <Phone className="size-8" aria-hidden />
                  <div>
                    <p className="font-serif text-[1.9rem] leading-[1.02]">Emergency words stop the chat.</p>
                    <p className="mt-2 font-semibold text-ink-950/75">It tells you to call 911 right away.</p>
                  </div>
                </div>
              </Reveal>
              <Reveal className="lg:col-span-3" delay={60}>
                <figure className="group relative h-full min-h-[16rem] overflow-hidden rounded-[2rem] bg-ink-950">
                  <img src="/marketing/hero-still.jpg" alt="A pill organizer, a glass of water, and a thermometer on a sunlit table." className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" style={{ objectPosition: "center 30%" }} />
                  <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/60 to-ink-950/10" />
                  <figcaption className="relative flex h-full max-w-xs flex-col justify-end p-6 text-white">
                    <Pill className="mb-3 size-6 text-apricot-400" aria-hidden />
                    <p className="font-serif text-[1.9rem] leading-[1.02]">A reminder repeats the label. It never makes up a dose.</p>
                  </figcaption>
                </figure>
              </Reveal>
              <Reveal className="lg:col-span-3" delay={120}>
                <div className="flex h-full flex-col justify-between gap-6 rounded-[2rem] bg-brand-800 p-6 text-white">
                  <ShieldCheck className="size-8 text-brand-200" aria-hidden />
                  <div>
                    <p className="font-serif text-[1.9rem] leading-[1.02]">Nothing saves until you confirm it.</p>
                    <p className="mt-2 text-white/75">Check a Health Concern is not a diagnosis. Your words and photo stay exactly as you saved them.</p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="people" className="scroll-mt-20 bg-white py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <h2 className={SERIF_H2}>
                You decide <span className="text-apricot-500 italic">who sees what.</span>
              </h2>
              <p className="mt-5 max-w-lg text-[1.12rem] leading-relaxed text-ink-600">
                Family and clinicians see a section only after you turn it on. There is no directory. Nobody finds a record by searching.
              </p>
              <div className="relative mt-8">
                <img src="/marketing/hero-golden.jpg" alt="An older woman sits with a younger family member on a sunny porch." className="aspect-[16/10] w-full rounded-[2rem] object-cover" />
                <div className="float-y absolute -bottom-5 left-5 flex items-center gap-2.5 rounded-full bg-white py-2 pr-4 pl-2 shadow-float">
                  <span className="grid size-8 place-items-center rounded-full bg-brand-800 text-white">
                    <ShieldCheck className="size-4" aria-hidden />
                  </span>
                  <span className="text-[0.92rem] font-semibold text-ink-900">Access ends the moment you switch it off</span>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <ShareDemo />
            </Reveal>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <Reveal>
              <h2 className={SERIF_H2}>
                Good <span className="text-apricot-500 italic">questions.</span>
              </h2>
              <p className="mt-5 max-w-sm text-[1.08rem] leading-relaxed text-ink-600">Something else on your mind? Open Quick assist at the bottom right and ask about the product.</p>
            </Reveal>
            <div className="grid gap-3">
              {FAQ.map((item, index) => (
                <Reveal key={item.q} delay={index * 60}>
                  <details className="group rounded-[1.4rem] border border-line bg-white px-5 py-4 transition-shadow open:shadow-raised">
                    <summary className="flex items-center justify-between gap-4 font-display text-[1.12rem] font-extrabold text-ink-950">
                      {item.q}
                      <span className="grid size-9 flex-none place-items-center rounded-full bg-sand text-[1.3rem] leading-none text-ink-700 transition-transform duration-300 group-open:rotate-45 group-open:bg-brand-800 group-open:text-white" aria-hidden>
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-[1.02rem] leading-relaxed text-ink-600">{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-8 sm:pb-28">
          <Reveal>
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-ink-950 px-6 py-16 text-center text-white sm:px-12 sm:py-24">
              <div className="drift pointer-events-none absolute -top-24 -left-24 size-[26rem] rounded-full bg-apricot-500/30 blur-3xl" aria-hidden />
              <div className="drift pointer-events-none absolute -right-24 -bottom-32 size-[30rem] rounded-full bg-brand-500/35 blur-3xl" style={{ animationDelay: "-7s" }} aria-hidden />
              <div className="relative">
                <h2 className="mx-auto max-w-3xl font-serif text-[clamp(2.6rem,6vw,4.8rem)] leading-[0.98] font-normal">
                  Start with one medicine. <span className="text-apricot-400 italic">Add the rest when you are ready.</span>
                </h2>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <Link href="/signup" className="group inline-flex min-h-14 items-center gap-2 rounded-full bg-apricot-500 px-7 text-[1.08rem] font-bold text-ink-950 transition-transform hover:-translate-y-0.5 hover:bg-apricot-400">
                    Create account
                    <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                  <Link href="/login" className="inline-flex min-h-14 items-center rounded-full border-2 border-white/30 px-7 text-[1.05rem] font-bold text-white transition-colors hover:border-white hover:bg-white hover:text-ink-950">
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="bg-brand-950 text-white">
        <div className="mx-auto max-w-7xl px-5 pt-16 pb-10 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <Logo inverse />
              <p className="mt-5 max-w-sm text-[1rem] leading-relaxed text-white/70">
                One record for medicines, visits, health concerns, and device readings, explained in plain language and shared only with the people you choose.
              </p>
              <a href="tel:911" className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-danger-200/30 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10">
                <span className="grid size-10 place-items-center rounded-full bg-danger-600 text-white">
                  <Phone className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-[1rem] font-extrabold">In an emergency, call 911</span>
                  <span className="block text-[0.88rem] text-white/60">Senior Guardian is not an emergency service.</span>
                </span>
              </a>
            </div>
            <FooterColumn
              title="Product"
              links={[
                ["Features", "#features"],
                ["Rings and watches", "#devices"],
                ["Safety", "#safety"],
                ["Sharing", "#people"],
                ["Questions", "#faq"],
              ]}
            />
            <FooterColumn
              title="Account"
              links={[
                ["Create account", "/signup"],
                ["Sign in", "/login"],
                ["Try a sample account", "/login"],
              ]}
            />
            <FooterColumn title="Help" links={[["Accessibility", "/accessibility"]]} />
          </div>
          <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-[0.9rem] text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Senior Guardian</p>
            <p className="max-w-xl sm:text-right">Informational only. It does not replace a doctor, pharmacist, or emergency services. AI-powered explanations can be wrong.</p>
          </div>
        </div>
        <div className="h-20" aria-hidden />
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="font-display text-[0.8rem] font-extrabold tracking-[0.16em] text-apricot-400 uppercase">{title}</p>
      <ul className="mt-4 grid gap-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="group inline-flex items-center gap-1 text-[1rem] text-white/80 transition-colors hover:text-white">
              {label}
              <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
