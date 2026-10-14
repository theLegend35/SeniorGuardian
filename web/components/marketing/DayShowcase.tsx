"use client";

import { Check, HeartPulse, ImageIcon, MessageCircleHeart, Mic, Pill, Send, Sparkles, Stethoscope, Watch, type LucideIcon } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { cx } from "@/components/ui/primitives";

const DURATION = 6500;

const STEPS: Array<{ icon: LucideIcon; time: string; title: string; body: string }> = [
  { icon: Pill, time: "8:00 AM", title: "Medicines, by the clock", body: "Each dose shows the time and the exact words from the label. One tap marks it taken." },
  { icon: MessageCircleHeart, time: "10:15 AM", title: "Ask out loud", body: "Speak or type a question. The answer sits under the original label, never in place of it." },
  { icon: HeartPulse, time: "2:30 PM", title: "Check a Health Concern", body: "Describe what you notice and add a photo. Your words stay as written, and you choose who sees them." },
  { icon: Watch, time: "8:46 PM", title: "Ring and watch readings", body: "Heart rate, sleep, steps, and blood oxygen at a glance. When the device goes quiet, it says offline." },
];

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export function DayShowcase() {
  const [index, setIndex] = useState(0);
  const [hold, setHold] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (hold || reduceMotion) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % STEPS.length), DURATION);
    return () => window.clearTimeout(timer);
  }, [hold, index, reduceMotion]);

  return (
    <div
      className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div role="tablist" aria-label="A day with Senior Guardian" className="grid gap-2">
        {STEPS.map((step, stepIndex) => {
          const active = stepIndex === index;
          return (
            <button
              key={step.title}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setIndex(stepIndex)}
              className={cx(
                "group relative overflow-hidden rounded-[1.4rem] border px-5 py-4 text-left transition-all duration-300",
                active ? "border-brand-800 bg-white shadow-raised" : "border-transparent hover:border-line hover:bg-white/60",
              )}
            >
              <span className="flex items-center gap-4">
                <span
                  className={cx(
                    "grid size-12 flex-none place-items-center rounded-2xl transition-colors duration-300",
                    active ? "bg-brand-800 text-white" : "bg-sand text-ink-600 group-hover:bg-sand-deep",
                  )}
                >
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={cx("block font-display text-[0.8rem] font-extrabold tracking-[0.14em] uppercase", active ? "text-apricot-500" : "text-ink-400")}>{step.time}</span>
                  <span className="block font-display text-[1.2rem] leading-tight font-extrabold text-ink-950">{step.title}</span>
                </span>
              </span>
              <span className={cx("grid transition-[grid-template-rows,opacity] duration-500", active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <span className="overflow-hidden">
                  <span className="block pt-3 pl-16 text-[1.02rem] leading-relaxed text-ink-600">{step.body}</span>
                </span>
              </span>
              {active ? (
                <span
                  key={`bar-${index}`}
                  className="hero-bar absolute inset-x-0 bottom-0 h-1 bg-apricot-400"
                  style={{ animationDuration: `${DURATION}ms`, animationPlayState: hold || reduceMotion ? "paused" : "running" }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative isolate mx-auto w-full max-w-[26rem]" aria-hidden>
        <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-apricot-100 via-brand-50 to-brand-100" />
        <div className="relative overflow-hidden rounded-[2.4rem] border-[10px] border-ink-950 bg-canvas shadow-float">
          <div className="flex items-center justify-between bg-white px-5 pt-3 pb-2 font-display text-[0.75rem] font-bold text-ink-500">
            <span>{STEPS[index].time}</span>
            <span className="h-1.5 w-14 rounded-full bg-ink-950/80" />
            <span>Senior Guardian</span>
          </div>
          <div key={index} className="h-[31rem] overflow-hidden px-4 pt-3 pb-5">
            {index === 0 ? <MedicinesScreen /> : index === 1 ? <AssistantScreen /> : index === 2 ? <ConcernScreen /> : <RingScreen />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="animate-fade-up px-1 pb-3">
      <p className="font-display text-[1.45rem] leading-tight font-extrabold text-ink-950">{title}</p>
      <p className="text-[0.88rem] text-ink-500">{sub}</p>
    </div>
  );
}

function MedicinesScreen() {
  const doses = [
    { time: "8:00 AM", name: "Lisinopril 10 mg", note: "Take one tablet by mouth every morning.", taken: true },
    { time: "8:00 AM", name: "Metformin 500 mg", note: "One tablet with breakfast.", taken: true },
    { time: "6:00 PM", name: "Metformin 500 mg", note: "One tablet with dinner.", taken: false },
    { time: "9:00 PM", name: "Atorvastatin 20 mg", note: "One tablet at bedtime.", taken: false },
  ];
  return (
    <div>
      <ScreenTitle title="Good morning, Eleanor" sub="Sunday, October 11" />
      <div className="animate-fade-up rounded-2xl bg-white p-4" style={delay(120)}>
        <div className="flex items-baseline justify-between font-display">
          <p className="text-[0.9rem] font-bold text-ink-600">
            <span className="text-[1.5rem] font-extrabold text-ink-950">2</span> of 4 doses taken
          </p>
          <p className="text-[0.85rem] font-extrabold text-brand-700">50%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
          <div className="grow-x h-full w-1/2 rounded-full bg-brand-500" style={delay(500)} />
        </div>
      </div>
      <ul className="mt-3 grid gap-2">
        {doses.map((dose, doseIndex) => (
          <li key={dose.time + dose.name} className="animate-fade-up flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3" style={delay(220 + doseIndex * 110)}>
            <span className={cx("grid size-9 flex-none place-items-center rounded-full", dose.taken ? "bg-brand-600 text-white" : "bg-apricot-50 text-apricot-700")}>
              {dose.taken ? <Check className="pop-in size-4" strokeWidth={3} style={delay(700 + doseIndex * 450)} /> : <Pill className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2 font-display">
                <span className="truncate text-[0.95rem] font-extrabold text-ink-950">{dose.name}</span>
                <span className="text-[0.78rem] font-bold text-ink-400">{dose.time}</span>
              </span>
              <span className="block truncate text-[0.8rem] text-ink-500">{dose.note}</span>
            </span>
            {dose.taken ? (
              <span className="pop-in rounded-full bg-brand-50 px-2 py-0.5 font-display text-[0.7rem] font-extrabold text-brand-800" style={delay(800 + doseIndex * 450)}>
                Taken
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssistantScreen() {
  return (
    <div className="flex h-full flex-col">
      <ScreenTitle title="Assistant" sub="Answers come from your saved record" />
      <div className="grid content-start gap-3">
        <p className="animate-fade-up ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-[0.92rem] text-white" style={delay(150)}>
          When do I take metformin?
        </p>
        <Bubble at={750} tone="plain" label="Original label">
          Take one 500 mg tablet by mouth twice a day with breakfast and dinner.
        </Bubble>
        <Bubble at={1400} tone="ai" label="AI-powered explanation">
          One tablet with breakfast and one with dinner, about 12 hours apart, always with food.
        </Bubble>
        <p className="animate-fade-up px-1 text-[0.78rem] text-ink-500" style={delay(2000)}>
          The label above is never changed. Ask your pharmacist about anything that looks different.
        </p>
      </div>
      <div className="animate-fade-up mt-auto flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pr-1.5 pl-4" style={delay(300)}>
        <span className="flex-1 text-[0.85rem] text-ink-400">Type or speak a question</span>
        <span className="grid size-9 place-items-center rounded-full bg-apricot-50 text-apricot-700">
          <Mic className="size-4" />
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-brand-700 text-white">
          <Send className="size-4" />
        </span>
      </div>
    </div>
  );
}

function Bubble({ at, tone, label, children }: { at: number; tone: "plain" | "ai"; label: string; children: ReactNode }) {
  return (
    <div className={cx("animate-fade-up overflow-hidden rounded-2xl border", tone === "ai" ? "border-ai-200 bg-ai-50" : "border-line-strong bg-white")} style={delay(at)}>
      <p className={cx("flex items-center gap-1.5 border-b px-3.5 py-1.5 font-display text-[0.68rem] font-extrabold tracking-[0.12em] uppercase", tone === "ai" ? "border-ai-200/70 text-ai-700" : "border-line bg-canvas text-ink-600")}>
        {tone === "ai" ? <Sparkles className="size-3" /> : null}
        {label}
      </p>
      <p className="px-3.5 py-2.5 text-[0.88rem] leading-relaxed text-ink-900">{children}</p>
    </div>
  );
}

function ConcernScreen() {
  return (
    <div>
      <ScreenTitle title="Left ankle swelling" sub="Saved today at 2:30 PM" />
      <div className="animate-fade-up overflow-hidden rounded-2xl border border-line-strong bg-white" style={delay(150)}>
        <p className="border-b border-line bg-canvas px-3.5 py-1.5 font-display text-[0.68rem] font-extrabold tracking-[0.12em] text-ink-600 uppercase">Your words</p>
        <p className="px-3.5 py-3 text-[0.9rem] leading-relaxed text-ink-900">My left ankle has been puffy for three days. It is not very painful. I did not fall.</p>
      </div>
      <div className="animate-fade-up mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-white p-3" style={delay(450)}>
        <span className="grid aspect-square place-items-center rounded-xl bg-gradient-to-br from-sand to-sand-deep text-ink-500">
          <ImageIcon className="size-6" />
        </span>
        <span>
          <span className="block font-display text-[0.92rem] font-extrabold text-ink-950">Photo attached</span>
          <span className="block text-[0.8rem] text-ink-500">Stays beside your words and any summary.</span>
        </span>
      </div>
      <div className="animate-fade-up mt-3 flex items-center gap-3 rounded-2xl bg-brand-800 px-4 py-3 text-white" style={delay(800)}>
        <Stethoscope className="size-5 flex-none text-brand-200" />
        <span className="text-[0.88rem]">
          Shared with <strong>Dr. Marcus Hale</strong> because you turned on Concerns.
        </span>
      </div>
      <p className="animate-fade-up mt-3 rounded-2xl bg-apricot-50 px-4 py-3 text-[0.82rem] leading-relaxed text-apricot-700" style={delay(1150)}>
        This is not a diagnosis. If it gets worse quickly, or you have chest pain or trouble breathing, call 911.
      </p>
    </div>
  );
}

function RingScreen() {
  const metrics = [
    { label: "Sleep", value: "7.2", unit: "hours", note: "Inside 6–9" },
    { label: "Steps", value: "2,480", unit: "", note: "In range" },
    { label: "Blood oxygen", value: "96", unit: "%", note: "Inside 94–100" },
  ];
  return (
    <div>
      <ScreenTitle title="Oura Ring" sub="Latest numbers showing" />
      <div className="animate-fade-up rounded-2xl border border-brand-200 bg-white p-4" style={delay(150)}>
        <div className="flex items-center justify-between">
          <p className="font-display text-[0.72rem] font-extrabold tracking-[0.12em] text-ink-500 uppercase">Heart rate</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 font-display text-[0.7rem] font-extrabold text-brand-800">
            <span className="size-1.5 rounded-full bg-brand-500" /> On
          </span>
        </div>
        <p className="mt-1 font-display text-[2.2rem] leading-none font-extrabold text-ink-950">
          112 <span className="text-[0.95rem] font-bold text-ink-500">bpm</span>
        </p>
        <p className="mt-1 text-[0.82rem] font-bold text-apricot-700">Outside your saved range of 50–100</p>
        <svg viewBox="0 0 300 70" className="mt-3 h-16 w-full" fill="none">
          <path d="M0 50 C 30 46, 45 52, 70 44 S 110 40, 135 46 S 175 30, 200 34 S 245 20, 270 14 L 300 8" stroke="#e4dccf" strokeWidth="10" strokeLinecap="round" />
          <path className="draw-line" d="M0 50 C 30 46, 45 52, 70 44 S 110 40, 135 46 S 175 30, 200 34 S 245 20, 270 14 L 300 8" stroke="#e57f33" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {metrics.map((metric, metricIndex) => (
          <div key={metric.label} className="animate-fade-up rounded-2xl bg-white px-3 py-3" style={delay(500 + metricIndex * 140)}>
            <p className="font-display text-[0.62rem] font-extrabold tracking-[0.1em] text-ink-500 uppercase">{metric.label}</p>
            <p className="mt-1 font-display text-[1.25rem] leading-none font-extrabold text-ink-950">
              {metric.value}
              {metric.unit ? <span className="ml-0.5 text-[0.7rem] font-bold text-ink-500">{metric.unit}</span> : null}
            </p>
            <p className="mt-1 text-[0.68rem] text-ink-500">{metric.note}</p>
          </div>
        ))}
      </div>
      <p className="animate-fade-up mt-3 px-1 text-[0.8rem] leading-relaxed text-ink-500" style={delay(1000)}>
        A number outside the range is a signal to look, not a diagnosis. Eleanor, Helen, and Dr. Hale each get an alert.
      </p>
    </div>
  );
}
