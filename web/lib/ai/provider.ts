import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

import { z } from "zod";

import { DEFAULT_SAVED, runtimeFor, type AiRuntime } from "@/lib/ai/runtime";

export type { AiRuntime };

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type ImageInput = { mimeType: string; data: Buffer };

export const VISION_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

type LimitKind = "switched" | "both" | "limited";

type LimitNotice = { kind: LimitKind; wait: string };

type Scope = { runtime: AiRuntime; notice: LimitNotice | null; namespace: string; backup: boolean };

const current = new AsyncLocalStorage<Scope>();

export function aiConfig(): AiRuntime {
  return current.getStore()?.runtime ?? runtimeFor(DEFAULT_SAVED);
}

/**
 * Runs AI calls with this model. `namespace` keeps a separate usage-limit pause (Spanish translation uses its own,
 * so a translation that hits a limit does not pause the health assistant). `backup: false` never switches to Groq.
 */
export function runWithAi<T>(runtime: AiRuntime, run: () => Promise<T>, options: { namespace?: string; backup?: boolean } = {}): Promise<T> {
  return current.run({ runtime, notice: null, namespace: options.namespace ?? "", backup: options.backup ?? true }, run);
}

export function limitNote(): string | null {
  const notice = current.getStore()?.notice;
  if (!notice) return null;
  if (notice.kind === "switched") {
    return `Our Gemini usage limit was reached, so this used Groq instead. You can switch to another model in Settings, or wait ${notice.wait}.`;
  }
  if (notice.kind === "both") {
    return `Our Gemini usage limit was reached, and the Groq backup is at its limit too. Switch to another model in Settings, or wait ${notice.wait}.`;
  }
  return `The usage limit was reached. Switch to another model in Settings, or wait ${notice.wait}.`;
}

export function appendLimitNote(text: string): string {
  const note = limitNote();
  if (!note || text.includes(note)) return text;
  return `${text.trim()}\n\n${note}`;
}

export function imagePart(image: ImageInput): ContentPart | null {
  if (!VISION_TYPES.has(image.mimeType)) return null;
  return { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data.toString("base64")}` } };
}

type Quiet = { until: number; waitMs: number };

const quietUntil = new Map<string, Quiet>();

export function clearAiLimitState(): void {
  quietUntil.clear();
}

class LimitHit extends Error {
  waitMs: number;

  constructor(waitMs: number) {
    super("ai-limit");
    this.waitMs = waitMs;
  }
}

/**
 * A usage limit belongs to one API key and model. Keying the pause by the label alone let one
 * person's own Groq or ChatGPT key pause that provider for everyone, including the shared Groq backup.
 * Only a short hash of the key is kept, never the key itself.
 */
function quietKey(runtime: AiRuntime): string {
  const keyHash = createHash("sha256").update(runtime.key).digest("hex").slice(0, 16);
  return `${current.getStore()?.namespace ?? ""}|${runtime.baseUrl}|${runtime.model}|${keyHash}`;
}

function remembered(runtime: AiRuntime): Quiet | null {
  const found = quietUntil.get(quietKey(runtime));
  if (!found || Date.now() >= found.until) return null;
  return found;
}

function rememberQuiet(runtime: AiRuntime, waitMs: number): void {
  const bounded = Math.min(Math.max(waitMs, 1_000), 48 * 60 * 60 * 1000);
  quietUntil.set(quietKey(runtime), { until: Date.now() + bounded, waitMs: bounded });
}

function waitPhrase(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 2) return "about a minute";
  if (minutes < 90) return `about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return hours === 1 ? "about 1 hour" : `about ${hours} hours`;
  const days = Math.max(1, Math.round(hours / 24));
  return days === 1 ? "about 1 day" : `about ${days} days`;
}

function parseRetryMs(detail: string, retryAfter: string | null): number {
  const header = Number(retryAfter);
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const match = detail.match(/retry in\s+(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:([\d.]+)\s*s)?/i);
  if (match && (match[1] || match[2] || match[3])) {
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
    if (ms > 0) return ms;
  }
  return 60_000;
}

function rememberNotice(kind: LimitKind, waitMs: number): void {
  const scope = current.getStore();
  if (!scope) return;
  scope.notice = { kind, wait: waitPhrase(waitMs) };
}

function isOurGemini(runtime: AiRuntime): boolean {
  return runtime.label === "Our Gemini";
}

function groqBackup(): AiRuntime {
  return runtimeFor({ provider: "ours", ours: "groq", model: "", apiKey: "" });
}

function textOf(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

function anthropicContent(content: string | ContentPart[]): string | Array<Record<string, unknown>> {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { type: "text", text: "" };
    return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
  });
}

function requestBody(runtime: AiRuntime, body: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...body };
  delete rest.reasoning_effort;
  return {
    model: runtime.model,
    ...rest,
    ...(runtime.gemini ? { reasoning_effort: body.reasoning_effort ?? "low" } : {}),
  };
}

async function requestOpenAi(runtime: AiRuntime, body: Record<string, unknown>): Promise<string | null> {
  const response = await fetch(`${runtime.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${runtime.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody(runtime, body)),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!response.ok) return fail(runtime, response);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  return payload.choices?.[0]?.message?.content?.trim() || null;
}

async function requestClaude(runtime: AiRuntime, body: Record<string, unknown>): Promise<string | null> {
  const messages = (body.messages as ChatMessage[] | undefined) ?? [];
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => textOf(message.content))
    .filter(Boolean)
    .join("\n\n");
  const turn = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: anthropicContent(message.content) }));
  const response = await fetch(`${runtime.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": runtime.key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtime.model,
      max_tokens: body.max_tokens ?? 1024,
      temperature: body.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages: turn.length ? turn : [{ role: "user", content: "Hello" }],
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!response.ok) return fail(runtime, response);
  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  return payload.content?.map((part) => part.text ?? "").join("").trim() || null;
}

async function fail(runtime: AiRuntime, response: Response): Promise<null> {
  const detail = (await response.text().catch(() => "")).replaceAll(runtime.key, "[key]");
  if (response.status === 429) throw new LimitHit(parseRetryMs(detail, response.headers.get("retry-after")));
  console.error(`[ai] ${runtime.label} ${runtime.model} returned ${response.status}: ${detail.slice(0, 300)}`);
  if (response.status === 401 || response.status === 403) throw new Error(`ai-${response.status}`);
  return null;
}

async function callModel(runtime: AiRuntime, body: Record<string, unknown>): Promise<string | null> {
  return runtime.kind === "anthropic" ? requestClaude(runtime, body) : requestOpenAi(runtime, body);
}

async function useGroqBackup(body: Record<string, unknown>, geminiWaitMs: number): Promise<string | null> {
  const groq = groqBackup();
  if (current.getStore()?.backup === false || !groq.configured) {
    rememberNotice("limited", geminiWaitMs);
    return null;
  }
  const groqQuiet = remembered(groq);
  if (groqQuiet) {
    rememberNotice("both", Math.max(geminiWaitMs, groqQuiet.waitMs));
    return null;
  }
  try {
    const text = await callModel(groq, body);
    if (!text) {
      rememberNotice("limited", geminiWaitMs);
      return null;
    }
    const scope = current.getStore();
    if (scope) scope.runtime = groq;
    rememberNotice("switched", geminiWaitMs);
    return text;
  } catch (error) {
    if (error instanceof LimitHit) {
      rememberQuiet(groq, error.waitMs);
      rememberNotice("both", Math.max(geminiWaitMs, error.waitMs));
      return null;
    }
    throw error;
  }
}

async function complete(body: Record<string, unknown>): Promise<string | null> {
  const runtime = aiConfig();
  if (!runtime.configured) return null;
  const quiet = remembered(runtime);
  if (quiet) {
    if (isOurGemini(runtime)) return useGroqBackup(body, quiet.waitMs);
    rememberNotice("limited", quiet.waitMs);
    return null;
  }
  try {
    return await callModel(runtime, body);
  } catch (error) {
    if (error instanceof LimitHit) {
      rememberQuiet(runtime, error.waitMs);
      if (isOurGemini(runtime)) return useGroqBackup(body, error.waitMs);
      rememberNotice("limited", error.waitMs);
      return null;
    }
    if (error instanceof Error && error.message.startsWith("ai-")) return null;
    const message = error instanceof Error ? error.message.replaceAll(runtime.key, "[key]") : "request failed";
    console.error(`[ai] ${runtime.label} ${runtime.model} request failed: ${message}`);
    return null;
  }
}

export async function generateText(messages: ChatMessage[], options: { maxTokens?: number; reasoning?: "low" | "none" } = {}): Promise<string | null> {
  return complete({
    messages,
    temperature: 0.2,
    max_tokens: options.maxTokens ?? 2048,
    ...(options.reasoning && aiConfig().gemini ? { reasoning_effort: options.reasoning } : {}),
  });
}

function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
}

export async function generateObject<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  name: string,
  options: { maxTokens?: number; reasoning?: "low" | "none"; retry?: boolean } = {},
): Promise<T | null> {
  if (!aiConfig().configured) return null;
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const maxTokens = options.maxTokens ?? 4096;

  const attempt = async (format: Record<string, unknown> | null, extra: ChatMessage[] = []) => {
    const text = await complete({
      messages: [...extra, ...messages],
      temperature: 0.2,
      max_tokens: maxTokens,
      ...(format ? { response_format: format } : {}),
      ...(options.reasoning && aiConfig().gemini ? { reasoning_effort: options.reasoning } : {}),
    });
    if (!text) return null;
    try {
      const parsed = schema.safeParse(parseJson(text));
      if (parsed.success) return parsed.data;
      console.error(`[ai] ${name} did not match the expected shape.`);
    } catch {
      console.error(`[ai] ${name} returned text that is not JSON.`);
    }
    return null;
  };

  if (aiConfig().kind === "anthropic") {
    return attempt(null, [{ role: "system", content: `Reply with one JSON object that matches this JSON Schema exactly:\n${JSON.stringify(jsonSchema)}` }]);
  }
  const structured = await attempt({ type: "json_schema", json_schema: { name, schema: jsonSchema, strict: true } });
  if (structured || options.retry === false) return structured;
  return attempt({ type: "json_object" }, [
    { role: "system", content: `Reply with one JSON object that matches this JSON Schema exactly:\n${JSON.stringify(jsonSchema)}` },
  ]);
}
