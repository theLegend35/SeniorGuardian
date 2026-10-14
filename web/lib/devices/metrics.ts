import { ValidationError } from "@/lib/auth/access";
import type { DeviceMetric, DeviceProvider, ReadingStatus } from "@/types/domain";

export const PROVIDER_LABELS: Record<DeviceProvider, string> = {
  google_health: "Google Health",
  oura: "Oura",
  withings: "Withings",
  fitbit: "Fitbit (old sign-in)",
  watch: "Watch without a cloud API",
  ring: "Ring without a cloud API",
};

export const METRICS: Record<DeviceMetric, { label: string; unit: string; min: number; max: number; step: string }> = {
  heart_rate: { label: "Heart rate", unit: "bpm", min: 20, max: 250, step: "1" },
  sleep_hours: { label: "Sleep", unit: "hours", min: 0, max: 24, step: "0.1" },
  steps: { label: "Steps", unit: "steps", min: 0, max: 200_000, step: "1" },
  blood_oxygen: { label: "Blood oxygen", unit: "%", min: 50, max: 100, step: "1" },
};

export function isProvider(value: string): value is DeviceProvider {
  return value in PROVIDER_LABELS;
}

export function isMetric(value: string): value is DeviceMetric {
  return value in METRICS;
}

export function parseMetricNumber(metric: DeviceMetric, raw: number): number {
  const spec = METRICS[metric];
  if (!Number.isFinite(raw)) throw new ValidationError(`${spec.label} needs a number.`);
  const value = metric === "sleep_hours" ? Math.round(raw * 10) / 10 : Math.round(raw);
  if (value < spec.min || value > spec.max) {
    throw new ValidationError(`${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}.`);
  }
  return value;
}

export function judgeReading(
  metric: DeviceMetric,
  value: number,
  range: { low: number; high: number } | null,
  source: string,
): { status: ReadingStatus; title: string; body: string } {
  const spec = METRICS[metric];
  if (!range) {
    return {
      status: "no_range",
      title: `${spec.label} saved`,
      body: `${spec.label} from ${source} is ${value} ${spec.unit}. No range is saved for this reading yet, so nothing was flagged.`,
    };
  }
  const outside = value < range.low || value > range.high;
  if (!outside) {
    return {
      status: "inside",
      title: `${spec.label} is inside the saved range`,
      body: `${spec.label} from ${source} is ${value} ${spec.unit}. The range saved on the record is ${range.low}–${range.high} ${spec.unit}.`,
    };
  }
  return {
    status: "outside",
    title: `${spec.label} is outside the saved range`,
    body: `${spec.label} from ${source} is ${value} ${spec.unit}. The range saved on the record is ${range.low}–${range.high} ${spec.unit}. This is a signal to look, not a diagnosis. If you feel unwell, contact a clinician. In an emergency, call 911.`,
  };
}
