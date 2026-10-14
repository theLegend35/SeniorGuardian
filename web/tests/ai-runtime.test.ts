import assert from "node:assert/strict";
import test from "node:test";

import { alarmCopy } from "@/lib/alarms/copy";
import { clearAiLimitState, generateText, limitNote, runWithAi } from "@/lib/ai/provider";
import { DEFAULT_SAVED, runtimeFor, settingsView } from "@/lib/ai/runtime";

const env = {
  GEMINI_API_KEY: "gemini-server-key-1234",
  GROQ_API_KEY: "groq-server-key-5678",
  AI_MODEL: "gemini-3.5-flash",
};

test("our Gemini key is the server key, and a personal ChatGPT key stays separate", () => {
  const ours = runtimeFor(DEFAULT_SAVED, env);
  assert.equal(ours.label, "Our Gemini");
  assert.equal(ours.model, "gemini-3.5-flash");
  assert.equal(ours.key, env.GEMINI_API_KEY);
  assert.equal(ours.configured, true);

  const own = "sk-personal-chatgpt-key";
  const chatgpt = runtimeFor({ provider: "chatgpt", ours: "gemini", model: "gpt-4o-mini", apiKey: own }, env);
  assert.equal(chatgpt.key, own);
  assert.equal(chatgpt.baseUrl, "https://api.openai.com/v1");
  assert.equal(chatgpt.configured, true);

  const view = settingsView({ provider: "chatgpt", ours: "gemini", model: "", apiKey: own }, env);
  assert.equal(JSON.stringify(view).includes(own), false);
  assert.equal(view.keyHint, "••••-key");
  assert.equal(view.ready.groq, true);
});

test("a blank Groq choice and Our Groq both use the quick assistant key", () => {
  const groq = runtimeFor({ ...DEFAULT_SAVED, provider: "groq" }, env);
  assert.equal(groq.key, env.GROQ_API_KEY);
  assert.equal(groq.baseUrl, "https://api.groq.com/openai/v1");

  const ours = runtimeFor({ ...DEFAULT_SAVED, ours: "groq" }, env);
  assert.equal(ours.configured, true);
  assert.equal(ours.label, "Groq");
  assert.equal(ours.key, env.GROQ_API_KEY);
  assert.equal(ours.model, "openai/gpt-oss-20b");
});

test("a due reminder is written from the label and does not ask a model", async () => {
  const draft = await alarmCopy({
    kind: "medication",
    key: "dose",
    patientId: "patient",
    patientName: "Eleanor Walsh",
    medicationId: "med",
    name: "Lisinopril 10 mg tablet",
    instructions: "Take one 10 mg tablet by mouth every morning.",
    time: "08:00",
    scheduledFor: "2026-10-14T08:00",
  });
  assert.equal(draft.source, "rules");
  assert.match(draft.body, /Take one 10 mg tablet by mouth every morning/);
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function withServerKeys(run: (calls: string[]) => Promise<void>): Promise<void> {
  const previous = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
  };
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = env.GROQ_API_KEY;
  process.env.AI_MODEL = env.AI_MODEL;
  clearAiLimitState();
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("api.groq.com")) return jsonResponse({ choices: [{ message: { content: "Hello Eleanor." } }] });
    return jsonResponse({ error: { message: "Please retry in 20h46m54s." } }, 429);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
    clearAiLimitState();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("our Gemini limit continues on Groq and says how long to wait", async () => {
  await withServerKeys(async (calls) => {
    let note = "";
    const text = await runWithAi(runtimeFor(DEFAULT_SAVED), async () => {
      const value = await generateText([{ role: "user", content: "hello" }]);
      note = limitNote() ?? "";
      return value;
    });
    assert.equal(text, "Hello Eleanor.");
    assert.equal(calls.length, 2);
    assert.match(calls[0], /generativelanguage/);
    assert.match(calls[1], /groq/);
    assert.match(note, /used Groq instead/);
    assert.match(note, /about 21 hours/);
    assert.match(note, /Settings/);
  });
});

test("a personal model limit does not switch to Groq", async () => {
  await withServerKeys(async (calls) => {
    const runtime = runtimeFor({ provider: "chatgpt", ours: "gemini", model: "gpt-4o-mini", apiKey: "sk-personal-chatgpt-key" });
    let note = "";
    const text = await runWithAi(runtime, async () => {
      const value = await generateText([{ role: "user", content: "hello" }]);
      note = limitNote() ?? "";
      return value;
    });
    assert.equal(text, null);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /api\.openai\.com/);
    assert.match(note, /The usage limit was reached/);
    assert.match(note, /about 21 hours/);
    assert.equal(note.includes("Groq"), false);
  });
});

test("a second question during the Gemini quiet period stays on Groq", async () => {
  await withServerKeys(async (calls) => {
    const ask = () =>
      runWithAi(runtimeFor(DEFAULT_SAVED), async () => {
        const value = await generateText([{ role: "user", content: "hello" }]);
        return { value, note: limitNote() ?? "" };
      });
    await ask();
    calls.length = 0;
    const second = await ask();
    assert.equal(second.value, "Hello Eleanor.");
    assert.equal(calls.some((url) => url.includes("generativelanguage")), false);
    assert.match(calls[0] ?? "", /groq/);
    assert.match(second.note, /used Groq instead/);
  });
});
