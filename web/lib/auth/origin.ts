import { headers } from "next/headers";

/** The site's own address, for links in account emails. Empty when it can't be told safely. */
export async function siteOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").split(",")[0]?.trim() ?? "";
  const proto = (headerStore.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
  if (!host || /[\s/]/.test(host)) return "";
  return `${proto}://${host}`;
}

/** Where a confirmation link in an email lands. */
export async function confirmUrl(flow: "signup" | "recovery"): Promise<string | undefined> {
  const origin = await siteOrigin();
  if (!origin) return undefined;
  return flow === "signup" ? `${origin}/auth/confirm?flow=signup` : `${origin}/auth/confirm`;
}
