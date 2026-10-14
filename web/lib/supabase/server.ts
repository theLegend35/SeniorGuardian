import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { supabasePublicEnv, supabaseSecretKey } from "@/lib/supabase/env";

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, key } = supabasePublicEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes the session.
        }
      },
    },
  });
}

export function createSupabaseAdminClient(): SupabaseClient {
  const { url } = supabasePublicEnv();
  return createClient(url, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
