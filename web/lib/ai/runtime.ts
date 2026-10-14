export const AI_PROVIDERS = ["ours", "groq", "claude", "gemini", "chatgpt"] as const;
export const OURS_CHOICES = ["gemini", "groq"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];
export type OursChoice = (typeof OURS_CHOICES)[number];

export type SavedAi = {
  provider: AiProvider;
  ours: OursChoice;
  model: string;
  apiKey: string;
};

export type AiRuntime = {
  key: string;
  baseUrl: string;
  model: string;
  label: string;
  configured: boolean;
  kind: "openai" | "anthropic";
  gemini: boolean;
};

export type AiSettingsView = {
  provider: AiProvider;
  ours: OursChoice;
  model: string;
  hasKey: boolean;
  keyHint: string;
  ready: { gemini: boolean; groq: boolean };
  activeLabel: string;
  activeModel: string;
  configured: boolean;
  usingServerGroq: boolean;
};

export const MODEL_DEFAULTS = {
  gemini: "gemini-3.5-flash",
  grok: "grok-3",
  groq: "openai/gpt-oss-20b",
  claude: "claude-sonnet-4-5",
  chatgpt: "gpt-4o-mini",
} as const;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

export const DEFAULT_SAVED: SavedAi = { provider: "ours", ours: "gemini", model: "", apiKey: "" };

type Env = Record<string, string | undefined>;

export function parseSaved(input: Partial<SavedAi> | null | undefined): SavedAi {
  const provider = AI_PROVIDERS.find((item) => item === input?.provider) ?? "ours";
  const rawOurs = String((input as { ours?: string } | null | undefined)?.ours ?? "");
  const ours: OursChoice = rawOurs === "groq" || rawOurs === "grok" ? "groq" : "gemini";
  return {
    provider,
    ours,
    model: typeof input?.model === "string" ? input.model.trim().slice(0, 80) : "",
    apiKey: typeof input?.apiKey === "string" ? input.apiKey.trim() : "",
  };
}

function geminiKey(env: Env): string {
  const generic = env.AI_API_KEY?.trim() ?? "";
  const base = env.AI_BASE_URL?.trim() ?? "";
  if (generic && (base === "" || base.includes("generativelanguage.googleapis.com"))) return generic;
  return env.GEMINI_API_KEY?.trim() ?? "";
}

function groqKey(env: Env): string {
  return env.GROQ_API_KEY?.trim() ?? "";
}

function modelOr(saved: string, fallback: string): string {
  return saved.trim() || fallback;
}

export function runtimeFor(saved: SavedAi, env: Env = process.env): AiRuntime {
  const choice = parseSaved(saved);
  if (choice.provider === "ours" && choice.ours === "groq") {
    const model = modelOr(choice.model, env.GROQ_MODEL?.trim() || MODEL_DEFAULTS.groq);
    const key = groqKey(env);
    return { key, baseUrl: "https://api.groq.com/openai/v1", model, label: "Groq", configured: key.length > 0, kind: "openai", gemini: false };
  }
  if (choice.provider === "ours") {
    const fromEnv = env.AI_MODEL?.trim() ?? "";
    const model = modelOr(choice.model, fromEnv.startsWith("gemini") ? fromEnv : MODEL_DEFAULTS.gemini);
    const key = geminiKey(env);
    return { key, baseUrl: GEMINI_BASE, model, label: "Our Gemini", configured: key.length > 0, kind: "openai", gemini: true };
  }
  if (choice.provider === "groq") {
    const key = choice.apiKey || groqKey(env);
    const model = modelOr(choice.model, env.GROQ_MODEL?.trim() || MODEL_DEFAULTS.groq);
    return { key, baseUrl: "https://api.groq.com/openai/v1", model, label: choice.apiKey ? "Groq" : "Groq", configured: key.length > 0, kind: "openai", gemini: false };
  }
  if (choice.provider === "claude") {
    const model = modelOr(choice.model, MODEL_DEFAULTS.claude);
    return { key: choice.apiKey, baseUrl: "https://api.anthropic.com/v1", model, label: "Claude", configured: choice.apiKey.length > 0, kind: "anthropic", gemini: false };
  }
  if (choice.provider === "chatgpt") {
    const model = modelOr(choice.model, MODEL_DEFAULTS.chatgpt);
    return { key: choice.apiKey, baseUrl: "https://api.openai.com/v1", model, label: "ChatGPT", configured: choice.apiKey.length > 0, kind: "openai", gemini: false };
  }
  const model = modelOr(choice.model, MODEL_DEFAULTS.gemini);
  return { key: choice.apiKey, baseUrl: GEMINI_BASE, model, label: "Gemini", configured: choice.apiKey.length > 0, kind: "openai", gemini: true };
}

export function settingsView(saved: SavedAi, env: Env = process.env): AiSettingsView {
  const choice = parseSaved(saved);
  const runtime = runtimeFor(choice, env);
  const hint = choice.apiKey.length >= 4 ? `••••${choice.apiKey.slice(-4)}` : "";
  return {
    provider: choice.provider,
    ours: choice.ours,
    model: choice.model,
    hasKey: choice.apiKey.length > 0,
    keyHint: hint,
    ready: { gemini: geminiKey(env).length > 0, groq: groqKey(env).length > 0 },
    activeLabel: runtime.label,
    activeModel: runtime.model,
    configured: runtime.configured,
    usingServerGroq: choice.provider === "groq" && choice.apiKey.length === 0 && groqKey(env).length > 0,
  };
}

export function defaultModel(provider: AiProvider, ours: OursChoice): string {
  if (provider === "ours") return ours === "groq" ? MODEL_DEFAULTS.groq : MODEL_DEFAULTS.gemini;
  return MODEL_DEFAULTS[provider];
}
