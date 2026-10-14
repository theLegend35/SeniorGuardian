import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AccessError } from "@/lib/auth/access";
import { SupabaseHealthStore } from "@/lib/supabase/store";
import { supabaseConfigured, supabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const Body = z.object({ messageId: z.string().uuid() });

export async function POST(request: Request) {
  if (!supabaseConfigured()) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Sign in again." }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Send the message id." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Send the message id." }, { status: 400 });

  const { url, key } = supabasePublicEnv();
  const userClient = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Sign in again." }, { status: 401 });

  const visible = await userClient.from("care_messages").select("id, author_id").eq("id", parsed.data.messageId).maybeSingle();
  if (visible.error || !visible.data || visible.data.author_id !== data.user.id) {
    return Response.json({ error: "That message is not yours." }, { status: 403 });
  }

  try {
    await new SupabaseHealthStore().notifyExistingCareMessage(data.user.id, parsed.data.messageId);
  } catch (err) {
    if (err instanceof AccessError) return Response.json({ error: "That message is not yours." }, { status: 403 });
    return Response.json({ error: "The alert could not be sent." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
