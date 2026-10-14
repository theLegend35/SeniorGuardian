import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { isDeviceSignInPath, takeSiteTicket } from "@/lib/mobile/site-ticket";
import { supabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "";
  const ticket = takeSiteTicket(url.searchParams.get("code") ?? "");
  const failed = new URL("/patient/devices", request.url);
  failed.searchParams.set("link", "failed");
  if (!ticket || !isDeviceSignInPath(next)) {
    return NextResponse.redirect(failed);
  }

  const pending: Array<{ name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }> = [];
  const { url: supabaseUrl, key } = supabasePublicEnv();
  const supabase = createServerClient(supabaseUrl, key, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        pending.splice(0, pending.length, ...cookiesToSet);
      },
    },
  });
  const { error } = await supabase.auth.setSession({
    access_token: ticket.accessToken,
    refresh_token: ticket.refreshToken,
  });
  const response = NextResponse.redirect(error ? failed : new URL(next, request.url));
  response.headers.set("Cache-Control", "no-store");
  if (!error) {
    for (const cookie of pending) response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
