import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { homeFor } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAuthConfigured, supabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const SIGNUP_TYPES = new Set(["signup", "email", "invite", "magiclink", "email_change"]);

function destination(request: Request, path: string) {
  const url = new URL(path, request.url);
  return url;
}

/** Where someone goes after confirming their email: their own home, or sign-in. */
async function afterConfirm(request: Request) {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const profileId = data?.claims?.sub;
    if (profileId) {
      const { SupabaseHealthStore } = await import("@/lib/supabase/store");
      const actor = await new SupabaseHealthStore().getActor(profileId);
      if (actor) return NextResponse.redirect(destination(request, homeFor(actor.role)));
    }
  }
  return NextResponse.redirect(destination(request, "/login?confirmed=1"));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const signup = url.searchParams.get("flow") === "signup" || (type !== null && SIGNUP_TYPES.has(type));
  const failed = destination(request, signup ? "/login?confirmed=0" : "/forgot?error=link");
  if (!supabaseAuthConfigured()) return NextResponse.redirect(failed);

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(destination(request, "/reset-password"));
  } else if (tokenHash && type && SIGNUP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) return afterConfirm(request);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return signup ? afterConfirm(request) : NextResponse.redirect(destination(request, "/reset-password"));
    // The link was opened in another browser. The email address is still confirmed, so sign in.
    if (signup) return NextResponse.redirect(destination(request, "/login?confirmed=1"));
  }

  return NextResponse.redirect(failed);
}
