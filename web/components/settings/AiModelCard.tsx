"use client";

import { Bot } from "lucide-react";
import { useState } from "react";

import { updateAiSettingsAction } from "@/lib/actions/ai-settings";
import { ActionForm } from "@/components/ui/forms";
import { Card, CardHeader } from "@/components/ui/primitives";
import type { AiProvider, AiSettingsView, OursChoice } from "@/lib/ai/runtime";

const CHOICES: Array<{ id: AiProvider; title: string; detail: string }> = [
  { id: "ours", title: "Our keys", detail: "Gemini, or the Groq key that runs the quick assistant." },
  { id: "groq", title: "Groq", detail: "Your own Groq key. Leave it blank to use the quick assistant key." },
  { id: "claude", title: "Claude", detail: "Your Anthropic key." },
  { id: "gemini", title: "Gemini", detail: "Your Google AI key." },
  { id: "chatgpt", title: "ChatGPT", detail: "Your OpenAI key." },
];

const DEFAULT_MODEL: Record<AiProvider, string> = {
  ours: "gemini-3.5-flash",
  gemini: "gemini-3.5-flash",
  groq: "openai/gpt-oss-20b",
  claude: "claude-sonnet-4-5",
  chatgpt: "gpt-4o-mini",
};
const GROQ_MODEL = "openai/gpt-oss-20b";

function readiness(view: AiSettingsView, provider: AiProvider, ours: OursChoice): string {
  if (provider === "ours" && ours === "gemini") return view.ready.gemini ? "Our Gemini key is ready." : "Our Gemini key is not on this server yet.";
  if (provider === "ours" && ours === "groq") return view.ready.groq ? "The quick assistant Groq key is ready." : "The quick assistant Groq key is not on this server yet.";
  if (provider === "groq" && !view.hasKey) return view.ready.groq ? "Leave the key blank to use the quick assistant Groq key." : "Paste a Groq key. It stays on the server.";
  if (view.hasKey && provider === view.provider) return `A key is saved (${view.keyHint}). Leave the box blank to keep it.`;
  return "Paste an API key. It stays on the server and is not shown again.";
}

export function AiModelCard({ view }: { view: AiSettingsView }) {
  const [provider, setProvider] = useState<AiProvider>(view.provider);
  const [ours, setOurs] = useState<OursChoice>(view.ours);
  const placeholder = provider === "ours" && ours === "groq" ? GROQ_MODEL : DEFAULT_MODEL[provider === "ours" ? "gemini" : provider];

  return (
    <Card>
      <CardHeader icon={Bot} title="Assistant model" description="Opening a page does not call the model. It runs when you ask a question, explain a label, add a document, or check a concern." />
      <div className="grid gap-4 px-6 pt-5 pb-6">
        <p className="text-[0.95rem] text-ink-700">
          {view.configured ? `Questions you ask use ${view.activeLabel}, model ${view.activeModel}.` : "Questions you ask use the saved record until a key is ready."}
        </p>
        <ActionForm action={updateAiSettingsAction} submit="Save model" pending="Saving…">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[0.95rem] font-semibold text-ink-900">Whose key</legend>
            {CHOICES.map((choice) => (
              <label key={choice.id} className="flex cursor-pointer gap-3 rounded-2xl border-2 border-line bg-white px-4 py-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/60">
                <input
                  type="radio"
                  name="provider"
                  value={choice.id}
                  checked={provider === choice.id}
                  onChange={() => setProvider(choice.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-ink-950">{choice.title}</span>
                  <span className="block text-[0.88rem] text-ink-500">{choice.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {provider === "ours" ? (
            <fieldset>
              <legend className="mb-2 text-[0.95rem] font-semibold text-ink-900">Which of our keys</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["gemini", "groq"] as const).map((choice) => (
                  <label key={choice} className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-white px-4 py-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/60">
                    <input type="radio" name="ours" value={choice} checked={ours === choice} onChange={() => setOurs(choice)} />
                    <span className="font-semibold text-ink-900">{choice === "gemini" ? "Gemini" : "Groq"}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <input type="hidden" name="ours" value={ours} />
          )}

          <p className="text-[0.9rem] text-ink-600">{readiness(view, provider, ours)}</p>

          <label className="block">
            <span className="mb-1.5 block text-[0.95rem] font-semibold text-ink-900">
              Model <span className="font-normal text-ink-400">(optional)</span>
            </span>
            <input name="model" defaultValue={view.model} placeholder={placeholder} autoComplete="off" spellCheck={false} className="input" />
            <span className="mt-1.5 block text-[0.85rem] text-ink-500">Leave this blank to use {placeholder}.</span>
          </label>

          {provider === "ours" ? null : (
            <div className="grid gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[0.95rem] font-semibold text-ink-900">
                  API key <span className="font-normal text-ink-400">(optional if one is already saved)</span>
                </span>
                <input name="apiKey" type="password" autoComplete="off" spellCheck={false} placeholder={view.hasKey ? view.keyHint : "Paste a key"} className="input" />
              </label>
              {view.hasKey ? (
                <label className="flex items-center gap-2 text-[0.92rem] text-ink-700">
                  <input type="checkbox" name="clearKey" />
                  Remove the saved key
                </label>
              ) : null}
            </div>
          )}
        </ActionForm>
      </div>
    </Card>
  );
}
