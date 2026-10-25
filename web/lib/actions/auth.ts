"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ConfirmEmailError, homeFor } from "@/lib/auth/access";
import { confirmUrl } from "@/lib/auth/origin";
import { resetEmailIssue, resetPasswordIssue } from "@/lib/auth/password-reset";
import { signInWithPassword, signOut, signUpAccount } from "@/lib/auth/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isSampleEmail } from "@/lib/demo/ids";
import { clearTutorial, startTutorial } from "@/lib/auth/tutorial";
import { actionError, type ActionState } from "@/lib/actions/state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAuthConfigured } from "@/lib/supabase/env";
import type { Role } from "@/types/domain";

const SAMPLE_PASSWORD_NOTICE = `Sample accounts share one password so everyone can try the site. Use ${DEMO_PASSWORD} from the sign-in page, or create your own account.`;

function safeNext(value: FormDataEntryValue | null, role: Role): string {
  const next = String(value ?? "");
  return next.startsWith(`/${role}/`) ? next : homeFor(role);
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let target = "";
  try {
    const actor = await signInWithPassword(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    target = safeNext(formData.get("next"), actor.role);
  } catch (error) {
    if (error instanceof ConfirmEmailError) return { notice: error.message };
    return actionError(error);
  }
  redirect(target);
}

export async function demoLoginAction(formData: FormData): Promise<void> {
  const account = DEMO_ACCOUNTS.find((item) => item.key === String(formData.get("account") ?? ""));
  if (!account) throw new Error("That sample account is not available.");
  const actor = await signInWithPassword(account.email, DEMO_PASSWORD);
  redirect(safeNext(formData.get("next"), actor.role));
}

export async function signupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const role = String(formData.get("role") ?? "patient") as Role;
  if (role !== "patient" && role !== "doctor" && role !== "caregiver") {
    return { error: "Choose patient, clinician, or caregiver." };
  }
  const email = String(formData.get("email") ?? "");
  if (isSampleEmail(email)) return { error: "That address belongs to the sample accounts. Use your own email address." };
  let target = "";
  let tour: Role | null = null;
  try {
    const actor = await signUpAccount({
      role,
      fullName: String(formData.get("fullName") ?? ""),
      email,
      password: String(formData.get("password") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      specialty: String(formData.get("specialty") ?? ""),
      clinic: String(formData.get("clinic") ?? ""),
      relationship: String(formData.get("relationship") ?? ""),
      dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    });
    tour = actor.role;
    target = homeFor(actor.role);
  } catch (error) {
    if (error instanceof ConfirmEmailError) return { notice: error.message };
    return actionError(error);
  }
  if (tour) await startTutorial(tour);
  redirect(target);
}

export async function dismissTutorialAction(): Promise<void> {
  await clearTutorial();
  revalidatePath("/", "layout");
}

export async function requestResetAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const issue = resetEmailIssue(email);
  if (issue) return { error: issue };
  if (isSampleEmail(email)) return { notice: SAMPLE_PASSWORD_NOTICE };
  if (!supabaseAuthConfigured()) {
    return { error: "Password reset email is available on the live site. On this copy, sign in with the password you created." };
  }
  try {
    const redirectTo = await confirmUrl("recovery");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) return { error: "We could not send the reset email. Wait a minute and try again." };
  } catch (error) {
    return actionError(error);
  }
  return { notice: "If that email has an account, we sent a link to choose a new password. Open it in this browser." };
}

export async function updatePasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const issue = resetPasswordIssue(password, confirm);
  if (issue) return { error: issue };
  if (!supabaseAuthConfigured()) {
    return { error: "Password reset is available when this site is connected to its account service." };
  }
  let target = "/login";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const profileId = data?.claims?.sub;
    if (!profileId) return { error: "This reset link has expired. Request a new one." };
    const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
    if (isSampleEmail(email)) return { error: SAMPLE_PASSWORD_NOTICE };
    const { SupabaseHealthStore } = await import("@/lib/supabase/store");
    const actor = await new SupabaseHealthStore().getActor(profileId);
    if (actor && isSampleEmail(actor.email)) return { error: SAMPLE_PASSWORD_NOTICE };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "That password could not be saved. Request a new link and try again." };
    target = actor ? homeFor(actor.role) : "/login";
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/");
}
