import { Watch } from "lucide-react";

import { MetricGauge } from "@/components/health/MetricGauge";
import { ActionForm } from "@/components/ui/forms";
import { Badge, Callout, EmptyState, Field, Select, buttonClass, cx } from "@/components/ui/primitives";
import { saveRangeAction, syncDeviceAction } from "@/lib/actions/health";
import { COMPATIBLE, INCOMPATIBLE, cloudProvider, type CloudProvider } from "@/lib/devices/catalog";
import { METRICS } from "@/lib/devices/metrics";
import { devicePresence } from "@/lib/devices/presence";
import type { DeviceBoard } from "@/lib/data/types";
import { formatWhen, localDate } from "@/lib/time";
import type { DeviceConnection, DeviceMetric, DeviceReading } from "@/types/domain";

const METRIC_ORDER: DeviceMetric[] = ["heart_rate", "sleep_hours", "steps", "blood_oxygen"];
const METRIC_LIST = Object.entries(METRICS) as Array<[DeviceMetric, (typeof METRICS)[DeviceMetric]]>;

function latestByMetric(board: DeviceBoard, connectionId: string): Map<DeviceMetric, DeviceReading> {
  const latest = new Map<DeviceMetric, DeviceReading>();
  for (const reading of board.readings) {
    if (reading.connectionId !== connectionId || latest.has(reading.metric)) continue;
    latest.set(reading.metric, reading);
  }
  return latest;
}

function StatGrid({ board, connectionId }: { board: DeviceBoard; connectionId: string }) {
  const latest = latestByMetric(board, connectionId);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {METRIC_ORDER.map((metric) => {
        const reading = latest.get(metric);
        const range = board.ranges.find((item) => item.metric === metric);
        if (!reading) {
          const spec = METRICS[metric];
          return (
            <div key={metric} className="rounded-2xl bg-canvas px-4 py-4 text-center">
              <p className="text-[0.78rem] font-bold tracking-wide text-ink-500 uppercase">{spec.label}</p>
              <p className="mt-2 font-serif text-[2.15rem] leading-none text-ink-300">—</p>
              <p className="mt-2 text-[0.86rem] font-semibold text-ink-500">Not in the last sync</p>
            </div>
          );
        }
        return (
          <MetricGauge
            key={metric}
            metric={{ metric, value: reading.value, unit: reading.unit, status: reading.status, low: range?.low ?? null, high: range?.high ?? null }}
          />
        );
      })}
    </div>
  );
}

function connectionFor(board: DeviceBoard, provider: CloudProvider): DeviceConnection | null {
  const rows = board.connections.filter((item) => item.provider === provider);
  return rows.find((item) => item.linked) ?? rows[0] ?? null;
}

export function DeviceReadingList({ board }: { board: DeviceBoard }) {
  const shown = board.connections.filter((item) => board.readings.some((reading) => reading.connectionId === item.id));
  if (!shown.length) return <EmptyState icon={Watch} title="No readings yet" />;
  return (
    <div className="grid gap-4">
      {shown.map((connection) => {
        const own = board.readings.filter((reading) => reading.connectionId === connection.id);
        const presence = devicePresence(connection.label, own);
        return (
          <article key={connection.id} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-serif text-[1.55rem] leading-tight text-ink-950">{connection.label}</h3>
                <p className={presence.on ? "mt-1 font-semibold text-brand-800" : "mt-1 font-semibold text-apricot-700"}>{presence.headline}</p>
                <p className="mt-1 text-[0.9rem] text-ink-600">{presence.detail}</p>
              </div>
              <span className={presence.on ? "rounded-full bg-brand-50 px-2.5 py-1 text-[0.75rem] font-bold text-brand-800" : "rounded-full bg-apricot-50 px-2.5 py-1 text-[0.75rem] font-bold text-apricot-700"}>
                {presence.on ? "On" : "Offline"}
              </span>
            </div>
            <div className="mt-4">
              <StatGrid board={board} connectionId={connection.id} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function DeviceCompatibility({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  const card = dark ? "rounded-[1.5rem] border border-white/15 bg-white/10 p-6" : "card p-6";
  const title = dark ? "text-white" : "text-ink-950";
  const body = dark ? "text-white/75" : "text-ink-600";
  const name = dark ? "text-white" : "text-ink-950";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <h3 className={`font-serif text-[1.7rem] leading-tight ${title}`}>Devices that can sign in</h3>
        <p className={`mt-2 text-[0.98rem] leading-relaxed ${body}`}>Senior Guardian reads the number from that company’s API after the person signs in to the account the device already uses.</p>
        <ul className="mt-5 grid gap-4">
          {COMPATIBLE.map((item) => (
            <li key={item.id}>
              <p className={`font-bold ${name}`}>{item.account}</p>
              <p className={`mt-1 text-[0.95rem] leading-relaxed ${body}`}>{item.devices}. Reads {item.reads.toLowerCase()}.</p>
              <p className={`mt-1 text-[0.9rem] leading-relaxed ${body}`}>{item.note}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className={card}>
        <h3 className={`font-serif text-[1.7rem] leading-tight ${title}`}>Devices this website cannot read</h3>
        <p className={`mt-2 text-[0.98rem] leading-relaxed ${body}`}>These stay on the phone or inside a private partner program. There is no sign-in here that can pull their numbers.</p>
        <ul className="mt-5 grid gap-4">
          {INCOMPATIBLE.map((item) => (
            <li key={item.name}>
              <p className={`font-bold ${name}`}>{item.name}</p>
              <p className={`mt-1 text-[0.95rem] leading-relaxed ${body}`}>{item.reason}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DeviceDesk({ board, banner, attention }: { board: DeviceBoard; banner?: string | null; attention?: string | null }) {
  // Only a reading from today raises the banner; older numbers stay in the history below.
  const flagged = board.readings.find((item) => item.status === "outside" && localDate(new Date(item.recordedAt)) === localDate());
  const cloudIds = new Set<string>(COMPATIBLE.map((item) => item.id));
  const other = board.connections.filter((item) => !cloudIds.has(item.provider) && board.readings.some((reading) => reading.connectionId === item.id));
  return (
    <div className="grid gap-6">
      {banner ? <Callout tone="brand">{banner}</Callout> : null}
      {flagged ? (
        <Callout tone="danger" title="A recent reading is outside the saved range">
          {METRICS[flagged.metric].label} was {flagged.value} {flagged.unit} at {formatWhen(flagged.recordedAt)}. This is a signal to look, not a diagnosis. If you feel unwell, contact a clinician. In an emergency, call 911.
        </Callout>
      ) : null}

      <div className="grid gap-5">
        {COMPATIBLE.map((spec) => {
          const connection = connectionFor(board, spec.id);
          const own = connection ? board.readings.filter((reading) => reading.connectionId === connection.id) : [];
          const newest = own[0];
          const presence = connection ? devicePresence(connection.label, own) : null;
          const showing = Boolean(connection?.linked || own.length);
          const focused = attention === spec.id;
          return (
            <article key={spec.id} className={cx("card p-5 sm:p-6", focused && "ring-2 ring-brand-700")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.78rem] font-bold tracking-[0.14em] text-brand-700 uppercase">{showing ? (presence?.on ? "On" : "Offline") : "Sign in"}</p>
                  <h2 className="mt-1 font-serif text-[1.85rem] leading-tight text-ink-950">{connection?.label || spec.account}</h2>
                  <p className="mt-1 max-w-2xl text-[0.95rem] text-ink-600">{presence ? presence.detail : spec.devices}</p>
                </div>
                <Badge tone={presence?.on ? "brand" : showing ? "apricot" : "neutral"}>{presence ? (presence.on ? "On" : "Offline") : "Not signed in"}</Badge>
              </div>

              {connection && showing ? (
                <div className="mt-5 grid gap-4">
                  <p className={presence?.on ? "font-semibold text-brand-800" : "font-semibold text-apricot-700"}>{presence?.headline}</p>
                  <StatGrid board={board} connectionId={connection.id} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[0.9rem] text-ink-500">{newest ? `Updated ${formatWhen(newest.recordedAt)}` : "Signed in. Refresh to read the latest day."}</p>
                    {connection.linked ? (
                      <ActionForm action={syncDeviceAction} submit="Refresh" pending="Reading…" variant="secondary" size="sm" className="gap-2">
                        <input type="hidden" name="connectionId" value={connection.id} />
                      </ActionForm>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-xl text-[0.98rem] leading-relaxed text-ink-700">
                    {spec.signIn} and Senior Guardian reads {spec.reads.toLowerCase()} from that account.
                  </p>
                  <a href={`/api/devices/${spec.id}/start`} className={buttonClass("primary", "lg")}>
                    {spec.signIn}
                  </a>
                </div>
              )}
              {focused && !connection?.linked && banner ? (
                <p className="mt-4 rounded-2xl border border-apricot-400 bg-apricot-50 px-4 py-3 text-[0.98rem] font-semibold text-ink-950">{banner}</p>
              ) : null}
            </article>
          );
        })}
      </div>

      {other.length ? (
        <section className="grid gap-3">
          <h2 className="text-[1.05rem] font-bold text-ink-950">Already on this record</h2>
          <DeviceReadingList board={{ ...board, connections: other }} />
        </section>
      ) : null}

      <details className="card group p-5 sm:p-6">
        <summary className="cursor-pointer font-bold text-ink-950">When a number should notify you</summary>
        <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-600">
          A synced reading is flagged only when it falls outside a range saved here. The notice goes to you, a caregiver who can see device readings, and a clinician you authorized. It is not a diagnosis, and an emergency is still a call to 911. If the device stops sending numbers, the card says it is offline.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ActionForm action={saveRangeAction} submit="Save range">
            <Select label="Reading" name="metric" required defaultValue="heart_rate">
              {METRIC_LIST.map(([value, spec]) => (
                <option key={value} value={value}>
                  {spec.label} ({spec.unit})
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Low" name="low" type="number" required step="any" />
              <Field label="High" name="high" type="number" required step="any" />
            </div>
          </ActionForm>
          {board.ranges.length ? (
            <ul className="grid content-start gap-2">
              {board.ranges.map((range) => (
                <li key={range.id} className="rounded-2xl bg-canvas px-4 py-3 text-[0.95rem] text-ink-800">
                  <span className="font-semibold">{METRICS[range.metric].label}</span> {range.low}–{range.high} {METRICS[range.metric].unit}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.95rem] text-ink-500">No ranges saved yet. Readings still appear on the card.</p>
          )}
        </div>
      </details>

    </div>
  );
}
