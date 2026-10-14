export type CloudProvider = "google_health" | "oura" | "withings";

export type CompatibleDevice = {
  id: CloudProvider;
  account: string;
  signIn: string;
  devices: string;
  reads: string;
  note: string;
  idEnv: string;
  secretEnv: string;
  redirectPath: string;
  setupUrl: string;
};

export const COMPATIBLE: CompatibleDevice[] = [
  {
    id: "google_health",
    account: "Google Health",
    signIn: "Sign in with Google",
    devices: "Fitbit trackers and Pixel Watch, once they sync to the Google Health account",
    reads: "Resting heart rate, steps, sleep, and blood oxygen",
    note: "Fitbit’s older website API is shutting down. These watches are read through Google Health. Google has to approve the Cloud project before sign-in works.",
    idEnv: "GOOGLE_HEALTH_CLIENT_ID",
    secretEnv: "GOOGLE_HEALTH_CLIENT_SECRET",
    redirectPath: "/api/devices/google_health/callback",
    setupUrl: "https://developers.google.com/health/setup",
  },
  {
    id: "oura",
    account: "Oura",
    signIn: "Sign in with Oura",
    devices: "Oura Ring generation 3 and later",
    reads: "Sleep, steps, heart rate, and blood oxygen",
    note: "A new Oura app can sign in about 10 people until Oura approves it.",
    idEnv: "OURA_CLIENT_ID",
    secretEnv: "OURA_CLIENT_SECRET",
    redirectPath: "/api/devices/oura/callback",
    setupUrl: "https://cloud.ouraring.com/docs/authentication",
  },
  {
    id: "withings",
    account: "Withings",
    signIn: "Sign in with Withings",
    devices: "ScanWatch, Body scales, BPM monitors, and Sleep Analyzer",
    reads: "Heart rate, steps, blood oxygen, and sleep",
    note: "The person signs in to the Withings account the device already uses.",
    idEnv: "WITHINGS_CLIENT_ID",
    secretEnv: "WITHINGS_CLIENT_SECRET",
    redirectPath: "/api/devices/withings/callback",
    setupUrl: "https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/register-your-application",
  },
];

export const INCOMPATIBLE: Array<{ name: string; reason: string }> = [
  { name: "Whoop", reason: "Whoop’s API is limited to approved partners." },
  { name: "Amazfit, Ultrahuman, RingConn, and other rings", reason: "These brands do not publish a sign-in API a website can use." },
  { name: "A watch or ring with no cloud account", reason: "Bluetooth on the wrist is not reachable from this website." },
];

const BY_ID = new Map(COMPATIBLE.map((item) => [item.id, item]));

export function isCloudProvider(value: string): value is CloudProvider {
  return BY_ID.has(value as CloudProvider);
}

export function cloudProvider(value: string): CompatibleDevice | null {
  return isCloudProvider(value) ? BY_ID.get(value)! : null;
}

export function providerConfigured(provider: CloudProvider): boolean {
  const spec = BY_ID.get(provider)!;
  return Boolean(process.env[spec.idEnv] && process.env[spec.secretEnv]);
}
