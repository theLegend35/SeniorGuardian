import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ConfirmEmailError, homeFor } from "@/lib/auth/access";
import { openSession, sealSession, SESSION_COOKIE } from "@/lib/auth/cookie";
import { confirmUrl } from "@/lib/auth/origin";
import { getStore } from "@/lib/data/index";
import type { SignupInput } from "@/lib/data/types";
import { clinicianEmailConfirmation, supabaseConfigured } from "@/lib/supabase/env";
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

function emailNotConfirmed(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message ?? "");
}

/** Sends the confirmation email again. Supabase limits how often this can run, so a failure is not an error. */
export async function resendConfirmation(email: string): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    const supabase = await createSupabaseServerClient();
    const redirect = await confirmUrl("signup");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: redirect ? { emailRedirectTo: redirect } : undefined,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function signInWithPassword(email: string, password: string, options: { resendConfirmation?: boolean } = {}): Promise<Actor> {
  if (supabaseConfigured()) {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    const supabase = await createSupabaseServerClient();
    const address = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });
    if (emailNotConfirmed(error)) {
      const sent = options.resendConfirmation === false ? false : await resendConfirmation(address);
      throw new ConfirmEmailError(
        sent
          ? `Confirm your email address first. We sent a new link to ${address}. Open it, then sign in.`
          : `Confirm your email address first. Open the link we sent to ${address}, then sign in.`,
      );
    }
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
  // A clinician or caregiver confirms their email before a patient can add them.
  const sent = supabaseConfigured() && input.role !== "patient" && clinicianEmailConfirmation() ? await resendConfirmation(profile.email) : false;
  try {
    return await signInWithPassword(profile.email, input.password, { resendConfirmation: false });
  } catch (error) {
    if (error instanceof ConfirmEmailError) {
      throw new ConfirmEmailError(
        sent
          ? `Your account is ready. We sent a confirmation link to ${profile.email}. Open it, then sign in.`
          : `Your account is ready, but the confirmation email could not be sent just now. Sign in a little later and we will send it again.`,
      );
    }
    throw error;
  }
}

export async function signOut(scope: "local" | "global" = "global"): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope });
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
