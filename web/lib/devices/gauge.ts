import type { DeviceMetric } from "@/types/domain";

/** Saved range when one exists. Otherwise a span where the middle is a half circle. */
const DISPLAY: Record<DeviceMetric, { low: number; high: number }> = {
  heart_rate: { low: 50, high: 100 },
  sleep_hours: { low: 6, high: 9 },
  steps: { low: 2000, high: 8000 },
  blood_oxygen: { low: 94, high: 100 },
};

export function gaugeScale(metric: DeviceMetric, low: number | null, high: number | null): { low: number; high: number } {
  if (low != null && high != null && high > low) return { low, high };
  return DISPLAY[metric];
}

/** 0 is an empty circle, 0.5 is a half circle, 1 is a full circle. */
export function gaugeFraction(value: number, low: number, high: number): number {
  if (!(high > low) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - low) / (high - low)));
}
