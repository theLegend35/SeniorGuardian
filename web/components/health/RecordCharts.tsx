import type { DeviceBoard } from "@/lib/data/types";
import { METRICS } from "@/lib/devices/metrics";
import { MetricGauges } from "@/components/health/MetricGauge";
import { devicePresence, EXAMPLE_OURA_ID } from "@/lib/devices/presence";
import { describeSeries, formatMetric, seriesFor } from "@/lib/devices/series";
import { formatWhen } from "@/lib/time";
import type { DeviceMetric, DeviceReading, ReadingRange } from "@/types/domain";

const ORDER: DeviceMetric[] = ["heart_rate", "sleep_hours", "steps", "blood_oxygen"];

function scaleOf(points: DeviceReading[], range: ReadingRange | undefined): { min: number; max: number } {
  const values = points.map((item) => item.value);
  if (range) values.push(range.low, range.high);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.2, 1);
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.18;
  return { min: min - pad, max: max + pad };
}

function axisLabel(value: number): string {
  if (Math.abs(value) >= 100) return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function SeriesChart({ metric, points, range }: { metric: DeviceMetric; points: DeviceReading[]; range: ReadingRange | undefined }) {
  const spec = METRICS[metric];
  const scale = scaleOf(points, range);
  const width = 680;
  const height = 210;
  const left = 46;
  const right = 12;
  const top = 28;
  const bottom = 36;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const times = points.map((item) => new Date(item.recordedAt).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const xAt = (time: number) => {
    if (t1 === t0) return left + plotW / 2;
    const pad = plotW * 0.08;
    return left + pad + ((time - t0) / (t1 - t0)) * (plotW - pad * 2);
  };
  const yAt = (value: number) => top + plotH - ((value - scale.min) / (scale.max - scale.min)) * plotH;
  const coords = points.map((item) => `${xAt(new Date(item.recordedAt).getTime())},${yAt(item.value)}`).join(" ");
  const ticks = [scale.min, (scale.min + scale.max) / 2, scale.max];
  const bandTop = range ? yAt(range.high) : 0;
  const bandBottom = range ? yAt(range.low) : 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={describeSeries(metric, points, range ?? null)} className="h-52 w-full">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={width - right} y1={yAt(tick)} y2={yAt(tick)} stroke="#e4ddd0" />
          <text x={left - 8} y={yAt(tick) + 4} textAnchor="end" fill="#5d6c72" fontSize="12">
            {axisLabel(tick)}
          </text>
        </g>
      ))}
      {range ? <rect x={left} y={Math.min(bandTop, bandBottom)} width={plotW} height={Math.abs(bandBottom - bandTop)} fill="#e7f2ef" /> : null}
      {points.length > 1 ? <polyline points={coords} fill="none" stroke="#0b564e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {points.map((item, index) => {
        const x = xAt(new Date(item.recordedAt).getTime());
        const y = yAt(item.value);
        const showValue = points.length <= 6 || index === points.length - 1;
        const showDate = points.length <= 4 || index === 0 || index === points.length - 1;
        return (
          <g key={item.id}>
            <circle cx={x} cy={y} r="5.5" fill={item.status === "outside" ? "#e57f33" : "#0b564e"} stroke="#fff" strokeWidth="2" />
            {showValue ? (
              <text x={x} y={y - 10} textAnchor="middle" fill="#1c3946" fontSize="12" fontWeight="700">
                {formatMetric(metric, item.value)}
              </text>
            ) : null}
            {showDate ? (
              <text x={x} y={height - 12} textAnchor="middle" fill="#5d6c72" fontSize="12">
                {stamp(item.recordedAt)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function compared(item: DeviceReading, range: ReadingRange | undefined): string {
  if (!range || item.status === "no_range") return "No range saved";
  return item.status === "outside" ? `Outside ${range.low}–${range.high}` : `Inside ${range.low}–${range.high}`;
}

export function MetricHistory({ board }: { board: DeviceBoard }) {
  const groups = ORDER.map((metric) => ({ metric, points: seriesFor(board.readings, metric), range: board.ranges.find((item) => item.metric === metric) })).filter((group) => group.points.length);
  if (!groups.length) return null;
  return (
    <div className="grid gap-4">
      {groups.map(({ metric, points, range }) => {
        const spec = METRICS[metric];
        const latest = points[points.length - 1];
        return (
          <article key={metric} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-serif text-[1.45rem] leading-tight text-ink-950">{spec.label} over time</h3>
                <p className="mt-1 text-[0.9rem] text-ink-500">{range ? `Saved range ${range.low}–${range.high} ${spec.unit}` : "No range saved"} · shaded band is that range</p>
              </div>
              <p className="font-serif text-[2rem] leading-none text-ink-950">
                {formatMetric(metric, latest.value)}
                <span className="ml-1 font-sans text-[0.95rem] font-semibold text-ink-500">{spec.unit}</span>
              </p>
            </div>
            <div className="mt-3">
              <SeriesChart metric={metric} points={points} range={range} />
            </div>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-700">{describeSeries(metric, points, range ?? null)}</p>
            <table className="mt-4 w-full text-left text-[0.92rem]">
              <caption className="sr-only">{spec.label} readings in the order they were recorded</caption>
              <thead className="text-[0.78rem] tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="py-2 font-semibold">Recorded</th>
                  <th className="py-2 font-semibold">Value</th>
                  <th className="py-2 font-semibold">Saved range</th>
                </tr>
              </thead>
              <tbody>
                {points.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="py-2 text-ink-700">{formatWhen(item.recordedAt)}</td>
                    <td className="py-2 font-semibold text-ink-950">
                      {formatMetric(metric, item.value)} {spec.unit}
                    </td>
                    <td className={item.status === "outside" ? "py-2 font-semibold text-apricot-700" : "py-2 text-ink-600"}>{compared(item, range)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        );
      })}
    </div>
  );
}

export function WearablePanel({ board }: { board: DeviceBoard }) {
  const connection = board.connections.find((item) => board.readings.some((reading) => reading.connectionId === item.id)) ?? board.connections[0];
  if (!connection) return <p className="mt-2 text-ink-500">No device on this record.</p>;
  const readings = board.readings.filter((reading) => reading.connectionId === connection.id);
  const presence = devicePresence(connection.label, readings, Date.now(), connection.id === EXAMPLE_OURA_ID);
  const heart = seriesFor(readings, "heart_rate");
  const range = board.ranges.find((item) => item.metric === "heart_rate");
  const latest = new Map<string, DeviceReading>();
  for (const reading of readings) {
    if (!latest.has(reading.metric)) latest.set(reading.metric, reading);
  }
  const gauges = [...latest.values()].map((reading) => {
    const saved = board.ranges.find((item) => item.metric === reading.metric);
    return { metric: reading.metric, value: reading.value, unit: reading.unit, status: reading.status, low: saved?.low ?? null, high: saved?.high ?? null };
  });
  return (
    <div className="mt-2 grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={presence.on ? "font-bold text-brand-800" : "font-bold text-apricot-700"}>{presence.headline}</p>
        <span className={presence.on ? "rounded-full bg-brand-50 px-2.5 py-1 text-[0.75rem] font-bold text-brand-800" : "rounded-full bg-apricot-50 px-2.5 py-1 text-[0.75rem] font-bold text-apricot-700"}>
          {presence.on ? "On" : "Offline"}
        </span>
      </div>
      <p className="text-[0.9rem] leading-relaxed text-ink-600">{presence.detail}</p>
      <MetricGauges metrics={gauges} />
      {heart.length > 1 ? <SeriesChart metric="heart_rate" points={heart} range={range} /> : null}
      <p className="text-[0.85rem] leading-relaxed text-ink-500">A number outside the saved range is a signal to look, not a diagnosis. It is sent to the person, an authorized caregiver, and an authorized clinician.</p>
    </div>
  );
}

export function ReadingSpark({ readings }: { readings: DeviceReading[] }) {
  const points = seriesFor(readings, "heart_rate").slice(-8);
  if (points.length < 2) return null;
  const max = Math.max(...points.map((item) => item.value));
  const min = Math.min(...points.map((item) => item.value));
  const span = Math.max(max - min, 1);
  const coords = points.map((item, index) => {
    const x = (index / (points.length - 1)) * 120;
    const y = 36 - ((item.value - min) / span) * 28;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-32" role="img" aria-label="Recent heart-rate readings">
      <polyline points={coords.join(" ")} fill="none" strokeWidth="2" className="stroke-brand-700" />
    </svg>
  );
}
