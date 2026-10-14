import { AsyncLocalStorage } from "node:async_hooks";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabasePublicEnv } from "@/lib/supabase/env";

const current = new AsyncLocalStorage<string>();

/** Run store queries as the phone's signed-in user. The website keeps using its cookie session. */
export function withRequestUser<T>(token: string, run: () => Promise<T>): Promise<T> {
  return current.run(token, run);
}

export function requestUserClient(): SupabaseClient | null {
  const token = current.getStore();
  if (!token) return null;
  const { url, key } = supabasePublicEnv();
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
