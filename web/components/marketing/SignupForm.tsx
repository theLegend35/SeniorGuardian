"use client";

import { useState } from "react";
import { HeartHandshake, Stethoscope, UserRound } from "lucide-react";

import { ActionForm } from "@/components/ui/forms";
import { Field, cx } from "@/components/ui/primitives";
import { signupAction } from "@/lib/actions/auth";
import type { Role } from "@/types/domain";

const ROLES: Array<{ value: Role; label: string; body: string; icon: typeof UserRound }> = [
  { value: "patient", label: "Patient", body: "Keep my own health information", icon: UserRound },
  { value: "caregiver", label: "Caregiver", body: "Help a family member", icon: HeartHandshake },
  { value: "doctor", label: "Clinician", body: "Review authorized patients", icon: Stethoscope },
];

export function SignupForm() {
  const [role, setRole] = useState<Role>("patient");
  return (
    <ActionForm action={signupAction} submit="Create account" pending="Creating account…" full size="lg">
      <fieldset>
        <legend className="mb-2 text-[0.95rem] font-semibold text-ink-900">I am a…</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {ROLES.map((item) => (
            <label
              key={item.value}
              className={cx(
                "flex cursor-pointer flex-col gap-1 rounded-2xl border-2 bg-white p-3.5 transition-colors",
                role === item.value ? "border-brand-600 bg-brand-50/60" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" name="role" value={item.value} checked={role === item.value} onChange={() => setRole(item.value)} className="sr-only" />
              <item.icon className={cx("size-5", role === item.value ? "text-brand-700" : "text-ink-500")} aria-hidden />
              <span className="font-bold text-ink-950">{item.label}</span>
              <span className="text-[0.82rem] leading-snug text-ink-500">{item.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Full name" name="fullName" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
      <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
      {role === "patient" ? <Field label="Date of birth" name="dateOfBirth" type="date" /> : null}
      {role === "doctor" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Specialty" name="specialty" placeholder="Internal medicine" />
          <Field label="Clinic" name="clinic" />
        </div>
      ) : null}
      {role === "caregiver" ? <Field label="Relationship" name="relationship" placeholder="Daughter, son, neighbor…" /> : null}
    </ActionForm>
  );
}
