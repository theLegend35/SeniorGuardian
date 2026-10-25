const DEV_ONLY_SECRET = "dev-only-senior-help-ai-change-me";

/**
 * The key that signs session cookies and device sign-in state.
 *
 * DEMO_SESSION_SECRET is used when it is set. On a live site connected to Supabase
 * without it, a key is derived from the server-only Supabase secret key, so the
 * public development key is never used in production. A production site with
 * neither refuses to sign anything.
 */
export function signingSecret(): string {
  const explicit = process.env.DEMO_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (supabaseSecret) return `senior-guardian-signing-v1:${supabaseSecret}`;
  if (process.env.NODE_ENV !== "production") return DEV_ONLY_SECRET;
  throw new Error("Set DEMO_SESSION_SECRET to a long random string before running the site in production.");
}
