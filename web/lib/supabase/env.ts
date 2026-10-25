export function supabaseAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Clinicians and caregivers confirm their email before a patient can add them.
 * Set CLINICIAN_EMAIL_CONFIRMATION=off only if the project cannot send email yet.
 */
export function clinicianEmailConfirmation(): boolean {
  return process.env.CLINICIAN_EMAIL_CONFIRMATION?.trim().toLowerCase() !== "off";
}

export function supabaseConfigured(): boolean {
  return supabaseAuthConfigured() && Boolean(process.env.SUPABASE_SECRET_KEY);
}

export function supabasePublicEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url, key };
}

export function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Supabase is not configured.");
  return key;
}
