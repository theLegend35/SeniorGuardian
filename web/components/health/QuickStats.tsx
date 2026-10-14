import Link from "next/link";
import { Watch } from "lucide-react";

import { MetricGauges } from "@/components/health/MetricGauge";
import type { QuickStat } from "@/lib/devices/quick-stats";

export function QuickStats({ stats }: { stats: QuickStat[] }) {
  if (!stats.length) return null;
  return (
    <section className="grid gap-3" aria-labelledby="quick-stats-title">
      <div>
        <h2 id="quick-stats-title" className="flex items-center gap-2 text-[1.3rem] font-extrabold text-ink-950">
          <Watch className="size-5 text-brand-700" aria-hidden /> Quick stats
        </h2>
        <p className="mt-1 text-[0.95rem] text-ink-600">The latest number from a connected wearable. The circle fills as the number moves through the saved range. Halfway is a half circle.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {stats.map((stat) => (
          <Link key={stat.patientId} href={`/doctor/patients/${stat.patientId}#readings`} className="card p-5 transition-shadow hover:shadow-raised">
            <span className="block font-bold text-ink-950">{stat.fullName}</span>
            {stat.metrics.length ? (
              <span className="mt-4 block">
                <MetricGauges metrics={stat.metrics} />
              </span>
            ) : (
              <span className="mt-3 block text-ink-500">Connected. No readings are stored yet.</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
