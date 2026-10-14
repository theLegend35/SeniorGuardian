import { createClient } from "@supabase/supabase-js";

import { AccessError, ValidationError } from "@/lib/auth/access";
import { getStore } from "@/lib/data/index";
import { mobileJson } from "@/lib/mobile/http";
import { supabaseConfigured, supabasePublicEnv } from "@/lib/supabase/env";
import { withRequestUser } from "@/lib/supabase/request-user";
import type { Actor } from "@/types/domain";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return /^Bearer\s+(\S+)/i.exec(header)?.[1]?.trim() || null;
}

export async function withMobileActor(request: Request, run: (actor: Actor) => Promise<Response>): Promise<Response> {
  try {
    if (!supabaseConfigured()) return mobileJson({ error: "Supabase is not configured." }, 503);
    const token = bearerToken(request);
    if (!token) return mobileJson({ error: "Sign in again." }, 401);
    const { url, key } = supabasePublicEnv();
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return mobileJson({ error: "Sign in again." }, 401);
    const userId = data.user.id;
    return await withRequestUser(token, async () => {
      const actor = await (await getStore()).getActor(userId);
      if (!actor) return mobileJson({ error: "Sign in again." }, 401);
      return run(actor);
    });
  } catch (error) {
    return mobileError(error);
  }
}

export function mobileError(error: unknown) {
  if (error instanceof ValidationError) return mobileJson({ error: error.message }, 400);
  if (error instanceof AccessError) return mobileJson({ error: error.message }, 403);
  console.error(error);
  return mobileJson({ error: "Something went wrong. Please try again." }, 500);
}
