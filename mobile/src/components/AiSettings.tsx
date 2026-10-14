import { Bot } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText, Button, Callout, Card, CardHeader, Field, Segmented } from "@/components/ui";
import { loadAiSettings, saveAiSettings, type AiProvider, type AiSettings, type OursChoice } from "@/lib/web-api";
import { colors } from "@/lib/theme";

const PROVIDERS: Array<{ value: AiProvider; label: string }> = [
  { value: "ours", label: "Our keys" },
  { value: "groq", label: "Groq" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "chatgpt", label: "ChatGPT" },
];

const DEFAULT_MODEL: Record<AiProvider, string> = {
  ours: "gemini-3.5-flash",
  gemini: "gemini-3.5-flash",
  groq: "openai/gpt-oss-20b",
  claude: "claude-sonnet-4-5",
  chatgpt: "gpt-4o-mini",
};

function note(view: AiSettings, provider: AiProvider, ours: OursChoice): string {
  if (provider === "ours" && ours === "gemini") return view.ready.gemini ? "Our Gemini key is ready." : "Our Gemini key is not on this server yet.";
  if (provider === "ours" && ours === "groq") return view.ready.groq ? "The quick assistant Groq key is ready." : "The quick assistant Groq key is not on this server yet.";
  if (provider === "groq" && !view.hasKey) return view.ready.groq ? "Leave the key blank to use the quick assistant Groq key." : "Paste a Groq key. It stays on the server.";
  if (view.hasKey && provider === view.provider) return `A key is saved (${view.keyHint}). Leave the box blank to keep it.`;
  return "Paste an API key. It stays on the server and is not shown again.";
}

export function AiSettingsCard() {
  const [view, setView] = useState<AiSettings | null>(null);
  const [provider, setProvider] = useState<AiProvider>("ours");
  const [ours, setOurs] = useState<OursChoice>("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let stopped = false;
    loadAiSettings()
      .then((next) => {
        if (stopped) return;
        setView(next);
        setProvider(next.provider);
        setOurs(next.ours);
        setModel(next.model);
      })
      .catch((err: unknown) => {
        if (!stopped) setError(err instanceof Error ? err.message : "The model settings could not be loaded.");
      });
    return () => {
      stopped = true;
    };
  }, []);

  const placeholder = provider === "ours" && ours === "groq" ? "openai/gpt-oss-20b" : DEFAULT_MODEL[provider === "ours" ? "gemini" : provider];

  const save = () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    saveAiSettings({ provider, ours, model, apiKey, clearKey })
      .then((next) => {
        setView(next);
        setProvider(next.provider);
        setOurs(next.ours);
        setModel(next.model);
        setApiKey("");
        setClearKey(false);
        setSaved(true);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The model could not be saved."))
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <CardHeader icon={Bot} title="Assistant model" description="Opening a page does not call the model. It runs when you ask, explain a label, add a document, or check a concern." />
      {error ? (
        <Callout tone="danger" title="Model settings">
          {error}
        </Callout>
      ) : null}
      {saved ? (
        <Callout tone="success" title="Saved">
          The next question uses this model.
        </Callout>
      ) : null}
      {view ? (
        <View style={{ gap: 12 }}>
          <AppText size={15} color={colors.ink700}>
            {view.configured ? `Questions you ask use ${view.activeLabel}, model ${view.activeModel}.` : "Questions you ask use the saved record until a key is ready."}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PROVIDERS.map((option) => {
              const on = provider === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setProvider(option.value)}
                  style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: on ? colors.brand700 : colors.sand }}
                >
                  <AppText size={15} weight="bold" color={on ? colors.white : colors.ink700}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {provider === "ours" ? (
            <Segmented
              options={[
                { value: "gemini", label: "Gemini" },
                { value: "groq", label: "Groq" },
              ]}
              value={ours}
              onChange={setOurs}
            />
          ) : null}
          <AppText size={14} color={colors.ink500}>
            {note(view, provider, ours)}
          </AppText>
          <Field label="Model" value={model} onChangeText={setModel} placeholder={placeholder} autoCapitalize="none" autoCorrect={false} optional />
          {provider === "ours" ? null : (
            <View style={{ gap: 10 }}>
              <Field label="API key" value={apiKey} onChangeText={setApiKey} placeholder={view.hasKey ? view.keyHint : "Paste a key"} secureTextEntry autoCapitalize="none" autoCorrect={false} optional />
              {view.hasKey ? (
                <Segmented
                  options={[
                    { value: "keep", label: "Keep key" },
                    { value: "remove", label: "Remove key" },
                  ]}
                  value={clearKey ? "remove" : "keep"}
                  onChange={(next) => setClearKey(next === "remove")}
                />
              ) : null}
            </View>
          )}
          <Button label="Save model" loading={saving} onPress={save} />
        </View>
      ) : error ? null : (
        <AppText size={15} color={colors.ink500}>
          Loading the model choice…
        </AppText>
      )}
    </Card>
  );
}
