import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAuthConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

function destination(request: Request, path: string) {
  const url = new URL(path, request.url);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failed = destination(request, "/forgot?error=link");
  if (!supabaseAuthConfigured()) return NextResponse.redirect(failed);

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(destination(request, "/reset-password"));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(destination(request, "/reset-password"));
  }

  return NextResponse.redirect(failed);
}
