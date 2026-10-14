import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { homeFor } from "@/lib/auth/access";
import { openSession, sealSession, SESSION_COOKIE } from "@/lib/auth/cookie";
import { getStore } from "@/lib/data/index";
import type { SignupInput } from "@/lib/data/types";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Actor, Role } from "@/types/domain";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
};

export async function currentActor(): Promise<Actor | null> {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const profileId = data?.claims?.sub;
    if (!profileId) return null;
    return (await getStore()).getActor(profileId);
  }
  const jar = await cookies();
  const session = await openSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return (await getStore()).getActor(session.profileId);
}

export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function requireRole(role: Role): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== role) redirect(homeFor(actor.role));
  return actor;
}

export async function signInWithPassword(email: string, password: string): Promise<Actor> {
  if (supabaseConfigured()) {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) throw new Error("That email or password is not correct.");
    const { SupabaseHealthStore } = await import("@/lib/supabase/store");
    const actor = await new SupabaseHealthStore().getActor(data.user.id);
    if (!actor) throw new Error("That account is not available.");
    return actor;
  }
  const store = await getStore();
  const profile = await store.verifyCredentials(email, password);
  if (!profile) throw new Error("That email or password is not correct.");
  const actor = await store.getActor(profile.id);
  if (!actor) throw new Error("That account is not available.");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sealSession(actor.profileId, actor.role), COOKIE_OPTIONS);
  return actor;
}

export async function signUpAccount(input: SignupInput): Promise<Actor> {
  const profile = await (await getStore()).createAccount(input);
  return signInWithPassword(profile.email, input.password);
}

export async function signOut(scope: "local" | "global" = "global"): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope });
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
