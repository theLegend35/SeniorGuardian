import type { DeviceSecret } from "@/lib/data/types";
import { parseMetricNumber } from "@/lib/devices/metrics";
import { cloudProvider, type CloudProvider } from "@/lib/devices/catalog";
import { localDate } from "@/lib/time";
import type { DeviceMetric } from "@/types/domain";

/**
 * One number from a vendor. `day` is the day the vendor says the number belongs to (YYYY-MM-DD, or null when the
 * vendor gave no date). The record keeps one reading per device, metric, and day, so a second sync of the same
 * day's number updates it instead of saving a copy. `latest` is false for the previous day's step total, which is
 * saved so a finished day has its final count.
 */
export type DeviceSample = { metric: DeviceMetric; value: number; day: string | null; latest: boolean };

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
].join(" ");

type TokenPayload = { access_token?: string; refresh_token?: string; expires_in?: number };

function creds(provider: CloudProvider): { id: string; secret: string } {
  const spec = cloudProvider(provider)!;
  return { id: process.env[spec.idEnv] ?? "", secret: process.env[spec.secretEnv] ?? "" };
}

function redact(provider: CloudProvider, body: string): string {
  const { id, secret } = creds(provider);
  return body.replaceAll(secret, "[secret]").replaceAll(id, "[id]").slice(0, 180);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function dateKey(value: unknown): number {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return Number(match[1]) * 10_000 + Number(match[2]) * 100 + Number(match[3]);
  }
  const record = asRecord(value);
  const date = asRecord(record?.date) ?? record;
  const year = asNumber(date?.year);
  const month = asNumber(date?.month);
  const day = asNumber(date?.day);
  if (year == null || month == null || day == null) return 0;
  return year * 10_000 + month * 100 + day;
}

function latest<T>(items: T[], key: (item: T) => number): T | null {
  let best: T | null = null;
  let score = -1;
  items.forEach((item, index) => {
    const value = key(item) || index;
    if (value >= score) {
      score = value;
      best = item;
    }
  });
  return best;
}

/**
 * The main sleep of the newest day: a nap on the same day must not replace the night's sleep, now that one
 * reading is kept per day. `main` scores each period (Oura marks the night as "long_sleep"; otherwise the longest).
 */
function mainSleep<T>(items: T[], day: (item: T) => number, main: (item: T) => number): T | null {
  const newest = latest(items, day);
  if (!newest) return null;
  const top = day(newest);
  if (!top) return newest;
  let best: T | null = null;
  for (const item of items) {
    if (day(item) !== top) continue;
    if (!best || main(item) > main(best)) best = item;
  }
  return best;
}

/** The newest item on an earlier day than `newest`, by the same date key. */
function dayBefore<T>(items: T[], key: (item: T) => number, newest: T | null): T | null {
  if (!newest) return null;
  const top = key(newest);
  if (!top) return null;
  return latest(items.filter((item) => key(item) > 0 && key(item) < top), key);
}

/** 20261021 → "2026-10-21". */
function dayOfKey(key: number): string | null {
  if (!key) return null;
  const year = Math.floor(key / 10_000);
  const month = Math.floor((key % 10_000) / 100);
  const day = key % 100;
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The app's local day (Central time) of a timestamp, given as ISO text or epoch seconds. */
function dayOfTime(value: unknown): string | null {
  const date = typeof value === "number" ? new Date(value * 1000) : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return localDate(date);
}

function push(out: DeviceSample[], seen: Set<DeviceMetric>, metric: DeviceMetric, raw: number | null, day: string | null) {
  if (raw == null || seen.has(metric)) return;
  try {
    out.push({ metric, value: parseMetricNumber(metric, raw), day, latest: true });
    seen.add(metric);
  } catch {
    // A vendor value outside the metric bounds is skipped, not stored.
  }
}

/** The previous day's step total, so that day keeps its final count after midnight. */
function pushEarlierSteps(out: DeviceSample[], raw: number | null, day: string | null) {
  const newest = out.find((item) => item.metric === "steps");
  if (raw == null || !day || !newest || newest.day === day) return;
  try {
    out.push({ metric: "steps", value: parseMetricNumber("steps", raw), day, latest: false });
  } catch {
    // Skipped, like any value outside the metric bounds.
  }
}

function ymd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function secretFrom(payload: TokenPayload, previousRefresh = ""): DeviceSecret {
  if (!payload.access_token) throw new Error("That account did not return a usable sign-in.");
  const refresh = payload.refresh_token || previousRefresh;
  if (!refresh) throw new Error("That account did not return a sign-in that can be refreshed. Sign in again and allow access.");
  return {
    accessToken: payload.access_token,
    refreshToken: refresh,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
  };
}

async function formToken(url: string, provider: CloudProvider, body: URLSearchParams, previousRefresh = ""): Promise<DeviceSecret> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${cloudProvider(provider)!.account} sign-in failed (${response.status}): ${redact(provider, raw)}`);
  const payload = JSON.parse(raw) as TokenPayload & { status?: number; body?: TokenPayload };
  if (provider === "withings") {
    if (payload.status !== 0 || !payload.body) throw new Error("Withings sign-in did not finish.");
    return secretFrom(payload.body, previousRefresh);
  }
  return secretFrom(payload, previousRefresh);
}

function isPrivateHost(hostname: string): boolean {
  return /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

export function authorizeUrl(provider: CloudProvider, redirectUri: string, state: string): string {
  const { id } = creds(provider);
  if (provider === "google_health") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("scope", GOOGLE_SCOPES);
    url.searchParams.set("state", state);
    if (isPrivateHost(new URL(redirectUri).hostname)) {
      url.searchParams.set("device_id", "senior-guardian");
      url.searchParams.set("device_name", "Senior Guardian");
    }
    return url.toString();
  }
  if (provider === "oura") {
    const url = new URL("https://cloud.ouraring.com/oauth/authorize");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "daily heartrate spo2");
    url.searchParams.set("state", state);
    return url.toString();
  }
  const url = new URL("https://account.withings.com/oauth2_user/authorize2");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "user.info,user.metrics,user.activity");
  url.searchParams.set("state", state);
  return url.toString();
}

export function exchangeCode(provider: CloudProvider, code: string, redirectUri: string): Promise<DeviceSecret> {
  const { id, secret } = creds(provider);
  if (provider === "google_health") {
    return formToken("https://oauth2.googleapis.com/token", provider, new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
    }));
  }
  if (provider === "oura") {
    return formToken("https://api.ouraring.com/oauth/token", provider, new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
    }));
  }
  return formToken("https://wbsapi.withings.net/v2/oauth2", provider, new URLSearchParams({
    action: "requesttoken",
    grant_type: "authorization_code",
    client_id: id,
    client_secret: secret,
    code,
    redirect_uri: redirectUri,
  }));
}

export function refreshCloud(provider: CloudProvider, refreshToken: string): Promise<DeviceSecret> {
  const { id, secret } = creds(provider);
  if (provider === "google_health") {
    return formToken("https://oauth2.googleapis.com/token", provider, new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: id,
      client_secret: secret,
    }), refreshToken);
  }
  if (provider === "oura") {
    return formToken("https://api.ouraring.com/oauth/token", provider, new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: id,
      client_secret: secret,
    }), refreshToken);
  }
  return formToken("https://wbsapi.withings.net/v2/oauth2", provider, new URLSearchParams({
    action: "requesttoken",
    grant_type: "refresh_token",
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
  }), refreshToken);
}

type GoogleResult = { status: number; body: unknown };

async function googleCall(token: string, url: string, init?: RequestInit): Promise<GoogleResult> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("Google Health sign-in expired. Sign in again.");
  const raw = await response.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

export type VendorSnapshot = {
  heart?: unknown;
  sleep?: unknown;
  steps?: unknown;
  oxygen?: unknown;
  activity?: unknown;
  measures?: unknown;
};

export function readingsFromVendor(provider: CloudProvider, snapshot: VendorSnapshot): DeviceSample[] {
  const out: DeviceSample[] = [];
  const seen = new Set<DeviceMetric>();
  if (provider === "google_health") readGoogle(snapshot, out, seen);
  if (provider === "oura") readOura(snapshot, out, seen);
  if (provider === "withings") readWithings(snapshot, out, seen);
  return out;
}

function readGoogle(snapshot: VendorSnapshot, out: DeviceSample[], seen: Set<DeviceMetric>) {
  const heartKey = (item: unknown) => dateKey(asRecord(asRecord(item)?.dailyRestingHeartRate)?.date);
  const heart = latest(asArray(asRecord(snapshot.heart)?.dataPoints), heartKey);
  push(out, seen, "heart_rate", asNumber(asRecord(asRecord(heart)?.dailyRestingHeartRate)?.beatsPerMinute), dayOfKey(heartKey(heart)));

  const sleepEnd = (item: unknown) => asRecord(asRecord(asRecord(item)?.sleep)?.interval)?.endTime;
  const asleep = (item: unknown) => asNumber(asRecord(asRecord(asRecord(item)?.sleep)?.summary)?.minutesAsleep) ?? 0;
  const sleepDay = (item: unknown) => {
    const day = dayOfTime(sleepEnd(item));
    return day ? Number(day.replaceAll("-", "")) : 0;
  };
  const sleep = mainSleep(asArray(asRecord(snapshot.sleep)?.dataPoints), sleepDay, asleep);
  const minutes = asNumber(asRecord(asRecord(asRecord(sleep)?.sleep)?.summary)?.minutesAsleep);
  push(out, seen, "sleep_hours", minutes == null ? null : minutes / 60, dayOfTime(sleepEnd(sleep)));

  const stepRows = asArray(asRecord(snapshot.steps)?.rollupDataPoints);
  const stepKey = (item: unknown) => dateKey(asRecord(item)?.civilStartTime);
  const steps = latest(stepRows, stepKey);
  push(out, seen, "steps", asNumber(asRecord(asRecord(steps)?.steps)?.countSum), dayOfKey(stepKey(steps)));
  const earlier = dayBefore(stepRows, stepKey, steps);
  pushEarlierSteps(out, asNumber(asRecord(asRecord(earlier)?.steps)?.countSum), dayOfKey(stepKey(earlier)));

  const oxygenKey = (item: unknown) => dateKey(asRecord(asRecord(item)?.dailyOxygenSaturation)?.date);
  const oxygen = latest(asArray(asRecord(snapshot.oxygen)?.dataPoints), oxygenKey);
  push(out, seen, "blood_oxygen", asNumber(asRecord(asRecord(oxygen)?.dailyOxygenSaturation)?.averagePercentage), dayOfKey(oxygenKey(oxygen)));
}

function readOura(snapshot: VendorSnapshot, out: DeviceSample[], seen: Set<DeviceMetric>) {
  const byDay = (item: unknown) => dateKey(asRecord(item)?.day);
  const activityRows = asArray(asRecord(snapshot.activity)?.data);
  const activity = latest(activityRows, byDay);
  push(out, seen, "steps", asNumber(asRecord(activity)?.steps), dayOfKey(byDay(activity)));
  const earlier = dayBefore(activityRows, byDay, activity);
  pushEarlierSteps(out, asNumber(asRecord(earlier)?.steps), dayOfKey(byDay(earlier)));

  const sleep = mainSleep(asArray(asRecord(snapshot.sleep)?.data), byDay, (item) => {
    const record = asRecord(item);
    const seconds = asNumber(record?.total_sleep_duration) ?? 0;
    return record?.type === "long_sleep" ? seconds + 1_000_000 : seconds;
  });
  const seconds = asNumber(asRecord(sleep)?.total_sleep_duration);
  push(out, seen, "sleep_hours", seconds == null ? null : seconds / 3600, dayOfKey(byDay(sleep)));
  push(out, seen, "heart_rate", asNumber(asRecord(sleep)?.average_heart_rate), dayOfKey(byDay(sleep)));

  const oxygen = latest(asArray(asRecord(snapshot.oxygen)?.data), byDay);
  push(out, seen, "blood_oxygen", asNumber(asRecord(asRecord(oxygen)?.spo2_percentage)?.average), dayOfKey(byDay(oxygen)));
}

function withingsOk(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record || record.status !== 0) return null;
  return asRecord(record.body);
}

function readWithings(snapshot: VendorSnapshot, out: DeviceSample[], seen: Set<DeviceMetric>) {
  const byDate = (item: unknown) => dateKey(asRecord(item)?.date);
  const activityRows = asArray(withingsOk(snapshot.activity)?.activities);
  const activity = latest(activityRows, byDate);
  const activityDay = dayOfKey(byDate(activity));
  push(out, seen, "steps", asNumber(asRecord(activity)?.steps), activityDay);
  const earlier = dayBefore(activityRows, byDate, activity);
  pushEarlierSteps(out, asNumber(asRecord(earlier)?.steps), dayOfKey(byDate(earlier)));
  push(out, seen, "heart_rate", asNumber(asRecord(activity)?.hr_average), activityDay);

  const groups = asArray(withingsOk(snapshot.measures)?.measuregrps);
  const measures = groups.flatMap((group) => asArray(asRecord(group)?.measures).map((measure) => ({ measure, date: asNumber(asRecord(group)?.date) ?? 0 })));
  const newest = (type: number) => {
    const match = latest(measures.filter((item) => asNumber(asRecord(item.measure)?.type) === type), (item) => item.date);
    const row = asRecord(match?.measure);
    const value = asNumber(row?.value);
    const unit = asNumber(row?.unit) ?? 0;
    return { value: value == null ? null : value * 10 ** unit, day: match?.date ? dayOfTime(match.date) : null };
  };
  const heart = newest(11);
  push(out, seen, "heart_rate", heart.value, heart.day);
  const oxygen = newest(54);
  push(out, seen, "blood_oxygen", oxygen.value, oxygen.day);

  const sleep = latest(asArray(withingsOk(snapshot.sleep)?.series), byDate);
  const slept = asNumber(asRecord(asRecord(sleep)?.data)?.total_sleep_time);
  push(out, seen, "sleep_hours", slept == null ? null : slept / 3600, dayOfKey(byDate(sleep)));
}

export async function fetchReadings(provider: CloudProvider, token: string): Promise<DeviceSample[]> {
  if (provider === "google_health") return fetchGoogle(token);
  if (provider === "oura") return fetchOura(token);
  return fetchWithings(token);
}

async function googleList(token: string, dataType: string, filter: string): Promise<GoogleResult> {
  const url = new URL(`https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints`);
  url.searchParams.set("pageSize", "14");
  url.searchParams.set("filter", filter);
  const filtered = await googleCall(token, url.toString());
  if (filtered.status !== 400) return filtered;
  url.searchParams.delete("filter");
  return googleCall(token, url.toString());
}

async function fetchGoogle(token: string): Promise<DeviceSample[]> {
  const start = ymd(daysAgo(2));
  const today = new Date();
  const since = ymd(daysAgo(14));
  const sleepUrl = new URL("https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints:reconcile");
  sleepUrl.searchParams.set("pageSize", "5");
  sleepUrl.searchParams.set("dataSourceFamily", "users/me/dataSourceFamilies/google-wearables");
  sleepUrl.searchParams.set("filter", `sleep.interval.civil_end_time >= "${start}"`);
  const rollup = JSON.stringify({
    range: {
      start: { date: { year: daysAgo(1).getFullYear(), month: daysAgo(1).getMonth() + 1, day: daysAgo(1).getDate() }, time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 } },
      end: { date: { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }, time: { hours: 23, minutes: 59, seconds: 59, nanos: 0 } },
    },
    windowSizeDays: 1,
    dataSourceFamily: "users/me/dataSourceFamilies/google-wearables",
  });
  const [heart, oxygen, sleep, steps] = await Promise.all([
    googleList(token, "daily-resting-heart-rate", `daily_resting_heart_rate.date >= "${since}"`),
    googleList(token, "daily-oxygen-saturation", `daily_oxygen_saturation.date >= "${since}"`),
    googleCall(token, sleepUrl.toString()),
    googleCall(token, "https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp", { method: "POST", body: rollup }),
  ]);
  if ([heart, oxygen, sleep, steps].every((item) => item.status === 403)) {
    throw new Error("Google Health did not allow these readings. Sign in again and accept access to activity, sleep, and health metrics.");
  }
  return readingsFromVendor("google_health", {
    heart: heart.status < 400 ? heart.body : undefined,
    oxygen: oxygen.status < 400 ? oxygen.body : undefined,
    sleep: sleep.status < 400 ? sleep.body : undefined,
    steps: steps.status < 400 ? steps.body : undefined,
  });
}

async function ouraGet(token: string, path: string, start: string, end: string): Promise<unknown> {
  const url = new URL(`https://api.ouraring.com/v2/usercollection/${path}`);
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("Oura sign-in expired. Sign in again.");
  if (response.status === 403) return null;
  if (!response.ok) throw new Error(`Oura did not return readings (${response.status}).`);
  return response.json();
}

async function fetchOura(token: string): Promise<DeviceSample[]> {
  const start = ymd(daysAgo(2));
  const end = ymd(new Date());
  const [activity, sleep, oxygen] = await Promise.all([
    ouraGet(token, "daily_activity", start, end),
    ouraGet(token, "sleep", start, end),
    ouraGet(token, "daily_spo2", start, end),
  ]);
  return readingsFromVendor("oura", { activity, sleep, oxygen });
}

async function withingsPost(token: string, url: string, body: URLSearchParams): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("Withings sign-in expired. Sign in again.");
  if (!response.ok) throw new Error(`Withings did not return readings (${response.status}).`);
  return response.json();
}

async function fetchWithings(token: string): Promise<DeviceSample[]> {
  const start = ymd(daysAgo(2));
  const end = ymd(new Date());
  const now = Math.floor(Date.now() / 1000);
  const [activity, measures, sleep] = await Promise.all([
    withingsPost(token, "https://wbsapi.withings.net/v2/measure", new URLSearchParams({
      action: "getactivity",
      startdateymd: start,
      enddateymd: end,
      data_fields: "steps,hr_average",
    })),
    withingsPost(token, "https://wbsapi.withings.net/measure", new URLSearchParams({
      action: "getmeas",
      meastypes: "11,54",
      category: "1",
      startdate: String(now - 2 * 86_400),
      enddate: String(now),
    })),
    withingsPost(token, "https://wbsapi.withings.net/v2/sleep", new URLSearchParams({
      action: "getsummary",
      startdateymd: start,
      enddateymd: end,
      data_fields: "total_sleep_time",
    })),
  ]);
  return readingsFromVendor("withings", { activity, measures, sleep });
}
