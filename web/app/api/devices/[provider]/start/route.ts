import { NextResponse } from "next/server";

import { AccessError, ValidationError } from "@/lib/auth/access";
import { currentActor } from "@/lib/auth/session";
import { beginCloudSignIn } from "@/lib/devices/begin";
import { isCloudProvider } from "@/lib/devices/catalog";
import { browserOrigin } from "@/lib/devices/public-origin";

export const dynamic = "force-dynamic";

function leave(request: Request, path: string, provider: string, link: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("link", link);
  if (provider) url.searchParams.set("provider", provider);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const actor = await currentActor();
  if (!actor || actor.role !== "patient" || !actor.patientId) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", "/patient/devices");
    return NextResponse.redirect(url);
  }
  const { provider } = await context.params;
  if (!isCloudProvider(provider)) return leave(request, "/patient/devices", "", "failed");
  try {
    const target = await beginCloudSignIn(actor, provider, browserOrigin(request));
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof ValidationError) return leave(request, "/patient/devices", provider, "unconfigured");
    if (error instanceof AccessError) return leave(request, "/patient/devices", provider, "failed");
    return leave(request, "/patient/devices", provider, "failed");
  }
}
