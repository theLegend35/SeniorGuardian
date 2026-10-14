import { Mail, RotateCcw, Shield, Type, UserRound } from "lucide-react";

import { AiModelCard } from "@/components/settings/AiModelCard";
import { ActionForm } from "@/components/ui/forms";
import { Callout, Card, CardHeader, Disclaimer, Field, PageHeader, buttonClass } from "@/components/ui/primitives";
import { resetDemoAction, updateSettingsAction } from "@/lib/actions/health";
import { readAiChoice } from "@/lib/ai/settings";
import { requireActor } from "@/lib/auth/session";
import { supabaseConfigured } from "@/lib/supabase/env";

const SCALES = [
  { value: "default", label: "Default", sample: "text-[1rem]" },
  { value: "large", label: "Large", sample: "text-[1.25rem]" },
  { value: "largest", label: "Extra large", sample: "text-[1.5rem]" },
] as const;

export async function SettingsScreen() {
  const actor = await requireActor();
  const connected = supabaseConfigured();
  const ai = await readAiChoice(actor.profileId);
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="Settings" description="Make the app easier to read, choose the assistant model, and keep your contact details current." />

      <Card>
        <CardHeader icon={UserRound} title="Profile and display" />
        <div className="px-6 pt-5 pb-6">
          <ActionForm action={updateSettingsAction} submit="Save settings">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="fullName" required defaultValue={actor.fullName} autoComplete="name" />
              <Field label="Phone" name="phone" type="tel" defaultValue={actor.phone} autoComplete="tel" />
            </div>
            <p className="flex items-center gap-2 text-[0.92rem] text-ink-500">
              <Mail className="size-4" aria-hidden /> Signed in as {actor.email}
            </p>
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-[0.95rem] font-semibold text-ink-900">
                <Type className="size-4" aria-hidden /> Text size
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {SCALES.map((scale) => (
                  <label
                    key={scale.value}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-line bg-white px-4 py-4 text-center transition-colors hover:border-line-strong has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/60"
                  >
                    <input type="radio" name="textScale" value={scale.value} defaultChecked={actor.textScale === scale.value} className="sr-only" />
                    <span className={`font-display font-extrabold text-ink-950 ${scale.sample}`}>Aa</span>
                    <span className="font-semibold text-ink-700">{scale.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[0.88rem] text-ink-500">Changes the size of all text in the app after you save.</p>
            </fieldset>
          </ActionForm>
        </div>
      </Card>

      <AiModelCard view={ai} />

      <Card>
        <CardHeader icon={Shield} title="Privacy" />
        <div className="grid gap-3 px-6 pt-4 pb-6 text-ink-700">
          <p>Your record is visible only to you and the people listed on your care team. Every clinician and caregiver needs your explicit permission.</p>
          <p>Senior Guardian organizes what you save and explains it with AI-powered plain language. It does not diagnose, prescribe, or replace a clinician, a pharmacist, or emergency services. In an emergency, call 911.</p>
        </div>
      </Card>

      {connected ? null : <Card>
        <CardHeader icon={RotateCcw} title="Local records" description="On this computer, records stay in a local file. Restore puts the sample records back to how they started." />
        <div className="grid gap-4 px-6 pt-4 pb-6">
          <Callout tone="warning">This restores the sample records for everyone using this copy of the app, and signs you out.</Callout>
          <form action={resetDemoAction}>
            <button type="submit" className={buttonClass("danger")}>
              <RotateCcw className="size-4" aria-hidden /> Restore sample records
            </button>
          </form>
        </div>
      </Card>}

      <Disclaimer />
    </div>
  );
}
