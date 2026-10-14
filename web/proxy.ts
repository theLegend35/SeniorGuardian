import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { homeFor } from "@/lib/auth/access";
import { openSession, SESSION_COOKIE } from "@/lib/auth/cookie";
import { supabaseAuthConfigured, supabasePublicEnv } from "@/lib/supabase/env";
import type { Role } from "@/types/domain";

function carry(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  return to;
}

function roleOf(value: unknown): Role | null {
  if (value === "patient" || value === "doctor" || value === "caregiver") return value;
  return null;
}

async function supabaseProxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabasePublicEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; app_metadata?: { role?: string } } | undefined;
  const signedIn = Boolean(claims?.sub);
  const role = roleOf(claims?.app_metadata?.role) ?? (signedIn ? "patient" : null);
  const { pathname } = request.nextUrl;
  const area = pathname.split("/")[1];
  const portal = area === "patient" || area === "doctor" || area === "caregiver";

  if (portal && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return carry(response, NextResponse.redirect(url));
  }
  if (signedIn && portal && role && role !== area) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return carry(response, NextResponse.redirect(url));
  }
  if (signedIn && role && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return carry(response, NextResponse.redirect(url));
  }
  return response;
}

function gate(request: NextRequest, session: { role: Role } | null) {
  const { pathname } = request.nextUrl;
  const area = pathname.split("/")[1];
  const portal = area === "patient" || area === "doctor" || area === "caregiver";

  if (portal && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (session && portal && session.role !== area) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (session && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  if (supabaseAuthConfigured()) return supabaseProxy(request);
  const session = await openSession(request.cookies.get(SESSION_COOKIE)?.value);
  return gate(request, session);
}

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/caregiver/:path*", "/login", "/signup"],
};
