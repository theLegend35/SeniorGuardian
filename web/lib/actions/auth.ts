"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { homeFor } from "@/lib/auth/access";
import { signInWithPassword, signOut, signUpAccount } from "@/lib/auth/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo/ids";
import { clearTutorial, startTutorial } from "@/lib/auth/tutorial";
import { actionError, type ActionState } from "@/lib/actions/state";
import type { Role } from "@/types/domain";

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
  let target = "";
  let tour: Role | null = null;
  try {
    const actor = await signUpAccount({
      role,
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
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
    return actionError(error);
  }
  if (tour) await startTutorial(tour);
  redirect(target);
}

export async function dismissTutorialAction(): Promise<void> {
  await clearTutorial();
  revalidatePath("/", "layout");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/");
}
