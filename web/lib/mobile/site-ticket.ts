const PROVIDERS = ["google_health", "oura", "withings"] as const;

export type DeviceSignInProvider = (typeof PROVIDERS)[number];

type Ticket = { accessToken: string; refreshToken: string; exp: number };

const tickets: Map<string, Ticket> = ((globalThis as { __siteTickets?: Map<string, Ticket> }).__siteTickets ??= new Map());

export function deviceSignInPath(provider: string): string | null {
  return (PROVIDERS as readonly string[]).includes(provider) ? `/api/devices/${provider}/start` : null;
}

export function isDeviceSignInPath(path: string): boolean {
  return PROVIDERS.some((provider) => path === `/api/devices/${provider}/start`);
}

export function issueSiteTicket(input: { accessToken: string; refreshToken: string }): string {
  const code = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  tickets.set(code, { accessToken: input.accessToken, refreshToken: input.refreshToken, exp: Date.now() + 60_000 });
  return code;
}

export function takeSiteTicket(code: string): { accessToken: string; refreshToken: string } | null {
  const ticket = tickets.get(code);
  tickets.delete(code);
  if (!ticket || ticket.exp < Date.now()) return null;
  return { accessToken: ticket.accessToken, refreshToken: ticket.refreshToken };
}
