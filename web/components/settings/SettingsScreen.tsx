import { Languages, Mail, RotateCcw, Shield, Type, UserRound } from "lucide-react";

import { AiModelCard } from "@/components/settings/AiModelCard";
import { ActionForm } from "@/components/ui/forms";
import { Callout, Card, CardHeader, Disclaimer, Field, PageHeader, buttonClass } from "@/components/ui/primitives";
import { resetDemoAction, updateSettingsAction } from "@/lib/actions/health";
import { readAiChoice } from "@/lib/ai/settings";
import { requireActor } from "@/lib/auth/session";
import { settingsCopy } from "@/lib/i18n";
import { supabaseConfigured } from "@/lib/supabase/env";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

export async function SettingsScreen() {
  const actor = await requireActor();
  const connected = supabaseConfigured();
  const ai = await readAiChoice(actor.profileId);
  const copy = settingsCopy();
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={copy.title} description={copy.description} />

      <Card>
        <CardHeader icon={UserRound} title={copy.profile} />
        <div className="px-6 pt-5 pb-6">
          <ActionForm action={updateSettingsAction} submit={copy.save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.name} name="fullName" required defaultValue={actor.fullName} autoComplete="name" />
              <Field label={copy.phone} name="phone" type="tel" defaultValue={actor.phone} autoComplete="tel" />
            </div>
            <p className="flex items-center gap-2 text-[0.92rem] text-ink-500">
              <Mail className="size-4" aria-hidden /> {copy.signedIn} {actor.email}
            </p>
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-[0.95rem] font-semibold text-ink-900">
                <Languages className="size-4" aria-hidden /> {copy.language}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {LANGUAGES.map((language) => (
                  <label
                    key={language.value}
                    className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-line bg-white px-4 py-4 text-center font-semibold text-ink-800 transition-colors hover:border-line-strong has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/60"
                  >
                    <input type="radio" name="locale" value={language.value} defaultChecked={actor.locale === language.value} className="sr-only" />
                    <span translate="no">{language.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[0.88rem] text-ink-500">{copy.languageHelp}</p>
            </fieldset>
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-[0.95rem] font-semibold text-ink-900">
                <Type className="size-4" aria-hidden /> {copy.textSize}
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {copy.scales.map((scale) => (
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
              <p className="mt-2 text-[0.88rem] text-ink-500">{copy.textHelp}</p>
            </fieldset>
          </ActionForm>
        </div>
      </Card>

      <AiModelCard view={ai} />

      <Card>
        <CardHeader icon={Shield} title={copy.privacy} />
        <div className="grid gap-3 px-6 pt-4 pb-6 text-ink-700">
          <p>{copy.privacyBody}</p>
          <p>{copy.privacyNote}</p>
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
