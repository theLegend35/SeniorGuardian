import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { runWithAi } from "@/lib/ai/provider";
import { DEFAULT_SAVED, parseSaved, runtimeFor, settingsView, type AiSettingsView, type SavedAi } from "@/lib/ai/runtime";
import { ValidationError } from "@/lib/auth/access";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type FileBook = Record<string, SavedAi>;

function filePath(): string {
  return path.join(process.cwd(), ".data", "ai-settings.json");
}

async function readFileBook(): Promise<FileBook> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as FileBook;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadSavedAi(profileId: string): Promise<SavedAi> {
  if (!supabaseConfigured()) {
    const book = await readFileBook();
    return parseSaved(book[profileId]);
  }
  const { data, error } = await createSupabaseAdminClient()
    .from("ai_preferences")
    .select("provider, ours_choice, model, api_key")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error || !data) return DEFAULT_SAVED;
  const row = data as { provider?: string; ours_choice?: string; model?: string; api_key?: string };
  return parseSaved({ provider: row.provider as SavedAi["provider"], ours: row.ours_choice as SavedAi["ours"], model: row.model, apiKey: row.api_key });
}

async function writeSavedAi(profileId: string, saved: SavedAi): Promise<void> {
  const choice = parseSaved(saved);
  if (!supabaseConfigured()) {
    const book = await readFileBook();
    book[profileId] = choice;
    await mkdir(path.dirname(filePath()), { recursive: true });
    await writeFile(filePath(), JSON.stringify(book), "utf8");
    return;
  }
  const { error } = await createSupabaseAdminClient().from("ai_preferences").upsert(
    {
      profile_id: profileId,
      provider: choice.provider,
      ours_choice: choice.ours,
      model: choice.model,
      api_key: choice.apiKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) throw new ValidationError("The model setting could not be saved.");
}

export async function readAiChoice(profileId: string): Promise<AiSettingsView> {
  return settingsView(await loadSavedAi(profileId));
}

export async function saveAiChoice(
  profileId: string,
  input: { provider: string; ours: string; model: string; apiKey: string; clearKey: boolean },
): Promise<AiSettingsView> {
  const provider = input.provider.trim();
  const ours = input.ours.trim();
  if (provider !== "ours" && provider !== "groq" && provider !== "claude" && provider !== "gemini" && provider !== "chatgpt") {
    throw new ValidationError("Choose a model provider.");
  }
  if (ours !== "gemini" && ours !== "groq") throw new ValidationError("Choose Gemini or Groq for our keys.");
  const model = input.model.trim();
  if (model && !/^[A-Za-z0-9_.:/-]{1,80}$/.test(model)) {
    throw new ValidationError("The model name can use letters, numbers, and . _ : / -");
  }
  const previous = await loadSavedAi(profileId);
  let apiKey = provider === previous.provider ? previous.apiKey : "";
  if (input.clearKey) apiKey = "";
  const typed = input.apiKey.trim();
  if (typed) {
    if (typed.length < 12 || typed.length > 300 || /\s/.test(typed)) throw new ValidationError("That API key does not look valid.");
    apiKey = typed;
  }
  const saved = parseSaved({ provider, ours, model, apiKey });
  await writeSavedAi(profileId, saved);
  return settingsView(saved);
}

export function withProfileAi<T>(profileId: string, run: () => Promise<T>): Promise<T> {
  return loadSavedAi(profileId).then((saved) => runWithAi(runtimeFor(saved), run));
}
