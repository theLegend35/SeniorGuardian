import { METRICS } from "@/lib/devices/metrics";
import { formatWhen } from "@/lib/time";
import type { DeviceMetric, DeviceReading } from "@/types/domain";

export function formatMetric(metric: DeviceMetric, value: number): string {
  if (metric === "steps") return value.toLocaleString("en-US");
  if (metric === "sleep_hours") return value.toFixed(1);
  return String(value);
}

export function seriesFor(readings: DeviceReading[], metric: DeviceMetric): DeviceReading[] {
  return readings.filter((item) => item.metric === metric).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export function describeSeries(metric: DeviceMetric, points: DeviceReading[], range: { low: number; high: number } | null): string {
  const spec = METRICS[metric];
  const latest = points[points.length - 1];
  const earliest = points[0];
  if (!latest || !earliest) return "";
  const low = Math.min(...points.map((item) => item.value));
  const high = Math.max(...points.map((item) => item.value));
  const outside = points.filter((item) => item.status === "outside").length;
  const count = points.length === 1 ? "1 reading" : `${points.length} readings`;
  const when = points.length === 1 ? `recorded ${formatWhen(latest.recordedAt)}` : `from ${formatWhen(earliest.recordedAt)} to ${formatWhen(latest.recordedAt)}`;
  const spread = points.length > 1 ? ` Lowest ${formatMetric(metric, low)} ${spec.unit}, highest ${formatMetric(metric, high)} ${spec.unit}.` : "";
  const rangeBit = !range
    ? " No range is saved for this metric."
    : outside === 0
      ? ` None are outside the saved range of ${range.low}–${range.high} ${spec.unit}.`
      : ` ${outside} of ${points.length} ${outside === 1 ? "is" : "are"} outside the saved range of ${range.low}–${range.high} ${spec.unit}.`;
  return `${count}, ${when}. Latest is ${formatMetric(metric, latest.value)} ${spec.unit}.${spread}${rangeBit} These numbers are copied from the record. This is a signal to look, not a diagnosis.`;
}
