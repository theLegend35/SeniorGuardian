"use client";

import { Bell, CalendarDays, HeartPulse, LockKeyhole, Pill, Route, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { cx } from "@/components/ui/primitives";

type Section = "Medicines" | "Appointments" | "Reminders" | "Timeline" | "Concerns";

const SECTIONS: Array<{ id: Section; icon: LucideIcon }> = [
  { id: "Medicines", icon: Pill },
  { id: "Appointments", icon: CalendarDays },
  { id: "Reminders", icon: Bell },
  { id: "Timeline", icon: Route },
  { id: "Concerns", icon: HeartPulse },
];

const PEOPLE = [
  { id: "helen", name: "Helen", full: "Helen Walsh", role: "Daughter", start: { Medicines: true, Appointments: true, Reminders: true, Timeline: false, Concerns: false } },
  { id: "hale", name: "Dr. Hale", full: "Dr. Marcus Hale", role: "Internal medicine", start: { Medicines: true, Appointments: true, Reminders: false, Timeline: true, Concerns: true } },
] as const;

type PersonId = (typeof PEOPLE)[number]["id"];

export function ShareDemo() {
  const [who, setWho] = useState<PersonId>("helen");
  const [access, setAccess] = useState<Record<PersonId, Record<Section, boolean>>>({
    helen: { ...PEOPLE[0].start },
    hale: { ...PEOPLE[1].start },
  });
  const person = PEOPLE.find((item) => item.id === who) ?? PEOPLE[0];
  const current = access[who];
  const openCount = SECTIONS.filter((section) => current[section.id]).length;

  return (
    <div className="rounded-[2rem] border border-line bg-white p-5 shadow-raised sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-[0.78rem] font-extrabold tracking-[0.14em] text-apricot-500 uppercase">Example. Try the switches.</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-sand p-1.5" role="tablist" aria-label="Person">
        {PEOPLE.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={who === item.id}
            onClick={() => setWho(item.id)}
            className={cx(
              "rounded-xl px-3 py-2.5 text-left transition-all duration-300",
              who === item.id ? "bg-white shadow-card" : "text-ink-600 hover:bg-white/50",
            )}
          >
            <span className="block font-display text-[1rem] font-extrabold text-ink-950">{item.full}</span>
            <span className="block text-[0.82rem] text-ink-500">{item.role}</span>
          </button>
        ))}
      </div>

      <ul className="mt-5 grid gap-1">
        {SECTIONS.map((section) => {
          const on = current[section.id];
          return (
            <li key={section.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-canvas">
                <span className={cx("grid size-10 flex-none place-items-center rounded-xl transition-colors duration-300", on ? "bg-brand-800 text-white" : "bg-sand text-ink-400")}>
                  {on ? <section.icon className="size-[1.1rem]" aria-hidden /> : <LockKeyhole className="size-[1.1rem]" aria-hidden />}
                </span>
                <span className="flex-1">
                  <span className="block font-display text-[1.02rem] font-extrabold text-ink-950">{section.id}</span>
                  <span className={cx("block text-[0.84rem] transition-colors", on ? "text-brand-700" : "text-ink-400")}>{on ? `${person.name} can see this` : "Closed"}</span>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={on}
                  onChange={(event) => setAccess((prev) => ({ ...prev, [who]: { ...prev[who], [section.id]: event.target.checked } }))}
                  aria-label={`Share ${section.id} with ${person.full}`}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <p key={`${who}-${openCount}`} className="animate-fade-up mt-4 rounded-2xl bg-canvas px-4 py-3 text-[0.95rem] text-ink-700">
        {openCount === 0
          ? `${person.full} sees nothing. Access closes the moment a switch turns off.`
          : `${person.full} sees ${openCount} of 5 sections. Everything else stays closed.`}
      </p>
    </div>
  );
}
