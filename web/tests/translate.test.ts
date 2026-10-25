import assert from "node:assert/strict";
import test from "node:test";

import { clearAiLimitState, generateText, runWithAi } from "@/lib/ai/provider";
import { DEFAULT_SAVED, runtimeFor } from "@/lib/ai/runtime";
import { builtInSpanish } from "@/lib/i18n/es";
import { acceptTranslation, clearTranslations, keepsNumbers, translateToSpanish } from "@/lib/i18n/translate";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Call = { url: string; init?: RequestInit };

async function withEnv(env: Record<string, string>, reply: (url: string, init?: RequestInit) => Response, run: (calls: Call[]) => Promise<void>) {
  const keys = ["GOOGLE_TRANSLATE_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "TRANSLATE_AI_DAILY_LIMIT"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, env);
  clearTranslations();
  clearAiLimitState();
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return reply(url, init);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
    clearTranslations();
    clearAiLimitState();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** A Gemini reply with the given translations, in the shape the translator asks for. */
function modelReply(items: Array<{ id: string; text: string }>): Response {
  return json({ choices: [{ message: { content: JSON.stringify({ translations: items }) } }] });
}

function sentItems(call: Call): Array<{ id: string; text: string }> {
  const body = JSON.parse(String(call.init?.body)) as { messages: Array<{ role: string; content: string }> };
  return JSON.parse(body.messages.find((message) => message.role === "user")!.content);
}

test("a translation must keep every number, in order", () => {
  assert.equal(keepsNumbers("Take 2 tablets at 8:00 PM", "Tome 2 tabletas a las 8:00 p. m."), true);
  assert.equal(keepsNumbers("Take 2 tablets every 6 hours", "Tome 6 tabletas cada 2 horas"), false);
  assert.equal(keepsNumbers("Take 2 tablets", "Tome 3 tabletas"), false);
  assert.equal(acceptTranslation("3 of 5 doses taken", "3 de 5 dosis tomadas"), "3 de 5 dosis tomadas");
  assert.equal(acceptTranslation("Take one 10 mg tablet", "Tome una tableta de 20 mg"), null);
  assert.equal(acceptTranslation("Hello", ""), null);
});

test("menus, safety lines, dates, and times have built-in Spanish and need no service", async () => {
  assert.equal(builtInSpanish("Mark taken"), "Marcar como tomada");
  assert.equal(builtInSpanish("Emergency? Call 911"), "¿Emergencia? Llame al 911");
  assert.equal(builtInSpanish("Wednesday, October 21, 2026"), "miércoles, 21 de octubre de 2026");
  assert.equal(builtInSpanish("Sun, October 25 at 10:30 AM"), "dom., 25 de octubre, a las 10:30 a. m.");
  assert.equal(builtInSpanish("Later today · can be marked from 7:00 PM"), "Más tarde hoy · se puede marcar desde las 7:00 p. m.");
  assert.equal(builtInSpanish("In 4 days"), "En 4 días");
  assert.equal(builtInSpanish("Outside 50–100"), "Fuera de 50–100");
  assert.equal(builtInSpanish("Eleanor Walsh"), "Eleanor Walsh");
  assert.equal(builtInSpanish("Some note a person wrote"), null);
  assert.equal(builtInSpanish("__proto__"), null);
  assert.equal(builtInSpanish("constructor"), null);
  await withEnv({}, () => json({}, 500), async (calls) => {
    assert.deepEqual(await translateToSpanish(["Mark taken", "8:00 PM", "Call 911"], "eleanor"), ["Marcar como tomada", "8:00 p. m.", "Llame al 911"]);
    assert.equal(calls.length, 0);
  });
});

test("with a Cloud key, the official API is used, the key stays out of the address, and results are shared", async () => {
  await withEnv(
    { GOOGLE_TRANSLATE_API_KEY: "cloud-key-123" },
    () => json({ data: { translations: [{ translatedText: "Mi tobillo está hinchado" }] } }),
    async (calls) => {
      assert.deepEqual(await translateToSpanish(["My ankle is swollen"], "eleanor"), ["Mi tobillo está hinchado"]);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://translation.googleapis.com/language/translate/v2");
      assert.equal(new Headers(calls[0].init?.headers).get("X-Goog-Api-Key"), "cloud-key-123");
      assert.deepEqual(await translateToSpanish(["My ankle is swollen"], "helen"), ["Mi tobillo está hinchado"]);
      assert.equal(calls.length, 1);
    },
  );
});

test("without a Cloud key, the AI model translates by id, only for the person who asked", async () => {
  await withEnv(
    { GEMINI_API_KEY: "gemini-key", AI_MODEL: "gemini-3.5-flash" },
    (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      const items = JSON.parse(body.messages.find((message) => message.role === "user")!.content) as Array<{ id: string; text: string }>;
      const spanish: Record<string, string> = {
        "My ankle is swollen": "Mi tobillo está hinchado",
        "Take 2 tablets every 6 hours": "Tome 6 tabletas cada 2 horas",
      };
      // Answered out of order: the ids, not the positions, decide which text is which.
      return modelReply(items.map((item) => ({ id: item.id, text: spanish[item.text] ?? "" })).reverse());
    },
    async (calls) => {
      const out = await translateToSpanish(["My ankle is swollen", "Take 2 tablets every 6 hours"], "eleanor");
      assert.deepEqual(out, ["Mi tobillo está hinchado", null]);
      assert.ok(calls.every((call) => !call.url.includes("translate_a") && !call.url.includes("translate.googleapis.com")));
      assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
      assert.deepEqual(sentItems(calls[0]).map((item) => item.id), ["t1", "t2"]);

      // Another person's page does not reuse a model's answer; it asks for itself.
      const before = calls.length;
      assert.deepEqual(await translateToSpanish(["My ankle is swollen"], "helen"), ["Mi tobillo está hinchado"]);
      assert.equal(calls.length, before + 1);
      // The text whose numbers moved is not asked again right away.
      assert.deepEqual(await translateToSpanish(["Take 2 tablets every 6 hours"], "eleanor"), [null]);
      assert.equal(calls.length, before + 1);
    },
  );
});

test("a translation that hits the usage limit does not pause the health assistant", async () => {
  let gemini = 0;
  await withEnv(
    { GEMINI_API_KEY: "gemini-key", AI_MODEL: "gemini-3.5-flash" },
    (url) => {
      if (!url.includes("generativelanguage")) return json({}, 500);
      gemini += 1;
      if (gemini === 1) return json({ error: { message: "Please retry in 2h." } }, 429);
      return json({ choices: [{ message: { content: "Hello Eleanor." } }] });
    },
    async () => {
      assert.deepEqual(await translateToSpanish(["My ankle is swollen"], "eleanor"), [null]);
      const answer = await runWithAi(runtimeFor(DEFAULT_SAVED), () => generateText([{ role: "user", content: "hello" }]));
      assert.equal(answer, "Hello Eleanor.");
      assert.equal(gemini, 2);
    },
  );
});

test("one person gets a small budget of model calls for translation", async () => {
  await withEnv(
    { GEMINI_API_KEY: "gemini-key", AI_MODEL: "gemini-3.5-flash" },
    (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      const items = JSON.parse(body.messages.find((message) => message.role === "user")!.content) as Array<{ id: string; text: string }>;
      return modelReply(items.map((item) => ({ id: item.id, text: `ES ${item.text}` })));
    },
    async (calls) => {
      for (let index = 0; index < 12; index += 1) await translateToSpanish([`Note number ${index}`], "mallory");
      assert.equal(calls.length, 12);
      assert.deepEqual(await translateToSpanish(["Note number 99"], "mallory"), [null]);
      assert.equal(calls.length, 12);
      // Someone else still has their own budget.
      assert.deepEqual(await translateToSpanish(["Note number 99"], "eleanor"), ["ES Note number 99"]);
    },
  );
});

test("with no translation service, unknown text stays in English without errors", async () => {
  await withEnv({}, () => json({}, 500), async (calls) => {
    assert.deepEqual(await translateToSpanish(["A note someone wrote"], "eleanor"), [null]);
    assert.equal(calls.length, 0);
  });
});

test("translation has a daily cap on model calls, and makes one request per batch", async () => {
  await withEnv(
    { GEMINI_API_KEY: "gemini-key", AI_MODEL: "gemini-3.5-flash", TRANSLATE_AI_DAILY_LIMIT: "2" },
    () => json({ choices: [{ message: { content: "not json" } }] }),
    async (calls) => {
      await translateToSpanish(["First note"], "a");
      assert.equal(calls.length, 1);
      await translateToSpanish(["Second note"], "b");
      await translateToSpanish(["Third note"], "c");
      assert.equal(calls.length, 2);
    },
  );
});
