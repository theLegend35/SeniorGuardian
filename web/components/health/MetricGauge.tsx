import { gaugeFraction, gaugeScale } from "@/lib/devices/gauge";
import { METRICS } from "@/lib/devices/metrics";
import { formatMetric } from "@/lib/devices/series";
import type { DeviceMetric, ReadingStatus } from "@/types/domain";

const RADIUS = 46;
const LENGTH = 2 * Math.PI * RADIUS;

export type GaugeMetric = {
  metric: DeviceMetric;
  value: number;
  unit: string;
  status: ReadingStatus;
  low: number | null;
  high: number | null;
};

export function MetricGauge({ metric }: { metric: GaugeMetric }) {
  const spec = METRICS[metric.metric];
  const scale = gaugeScale(metric.metric, metric.low, metric.high);
  const fraction = gaugeFraction(metric.value, scale.low, scale.high);
  const outside = metric.status === "outside";
  const shown = formatMetric(metric.metric, metric.value);
  return (
    <figure className="grid justify-items-center gap-1">
      <svg viewBox="0 0 120 120" className="size-28" role="img" aria-label={`${spec.label} ${shown} ${metric.unit}, ${Math.round(fraction * 100)} percent of ${scale.low} to ${scale.high}`}>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#e8e1d2" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke={outside ? "#e57f33" : "#0d665b"}
          strokeWidth="10"
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          className="gauge-arc"
          style={{ ["--gauge-len" as string]: LENGTH, strokeDasharray: LENGTH, strokeDashoffset: LENGTH * (1 - fraction) }}
        />
        <text x="60" y="58" textAnchor="middle" fill="#0a1a22" fontSize="22" fontFamily="Georgia, serif">
          {shown}
        </text>
        <text x="60" y="76" textAnchor="middle" fill="#5d6c72" fontSize="11">
          {metric.unit}
        </text>
      </svg>
      <figcaption className="text-center">
        <span className="block text-[0.75rem] font-bold tracking-wide text-ink-500 uppercase">{spec.label}</span>
        <span className={outside ? "mt-0.5 block text-[0.78rem] font-semibold text-apricot-700" : "mt-0.5 block text-[0.78rem] font-semibold text-brand-800"}>
          {metric.low == null || metric.high == null || metric.status === "no_range" ? "No range saved" : metric.status === "outside" ? `Outside ${metric.low}–${metric.high}` : `Inside ${metric.low}–${metric.high}`}
        </span>
      </figcaption>
    </figure>
  );
}

export function MetricGauges({ metrics }: { metrics: GaugeMetric[] }) {
  if (!metrics.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((metric) => (
        <MetricGauge key={metric.metric} metric={metric} />
      ))}
    </div>
  );
}
