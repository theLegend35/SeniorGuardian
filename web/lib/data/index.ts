import { getFileStore } from "@/lib/demo/store";
import type { HealthStore } from "@/lib/data/types";
import { supabaseAuthConfigured, supabaseConfigured } from "@/lib/supabase/env";

export async function getStore(): Promise<HealthStore> {
  if (supabaseConfigured()) {
    const { SupabaseHealthStore } = await import("@/lib/supabase/store");
    return new SupabaseHealthStore();
  }
  if (supabaseAuthConfigured()) {
    throw new Error("Supabase is only partly configured. Set the URL, publishable key, and secret key together.");
  }
  return getFileStore();
}
