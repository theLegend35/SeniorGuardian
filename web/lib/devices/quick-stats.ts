import type { DeviceBoard } from "@/lib/data/types";
import type { DeviceMetric, ReadingStatus } from "@/types/domain";

const ORDER: DeviceMetric[] = ["heart_rate", "sleep_hours", "steps", "blood_oxygen"];

export type QuickStatMetric = {
  metric: DeviceMetric;
  value: number;
  unit: string;
  status: ReadingStatus;
  low: number | null;
  high: number | null;
};

export type QuickStat = {
  patientId: string;
  fullName: string;
  metrics: QuickStatMetric[];
};

export function wearableQuickStats(rows: Array<{ patientId: string; fullName: string; board: DeviceBoard }>): QuickStat[] {
  return rows.flatMap(({ patientId, fullName, board }) => {
    const connected = new Set(
      board.connections
        .filter((connection) => connection.linked || board.readings.some((reading) => reading.connectionId === connection.id))
        .map((connection) => connection.id),
    );
    if (!connected.size) return [];
    const latest = new Map<DeviceMetric, (typeof board.readings)[number]>();
    for (const reading of board.readings) {
      if (!connected.has(reading.connectionId) || latest.has(reading.metric)) continue;
      latest.set(reading.metric, reading);
    }
    return [
      {
        patientId,
        fullName,
        metrics: ORDER.flatMap((metric) => {
          const reading = latest.get(metric);
          if (!reading) return [];
          const range = board.ranges.find((item) => item.metric === metric);
          return [{ metric, value: reading.value, unit: reading.unit, status: reading.status, low: range?.low ?? null, high: range?.high ?? null }];
        }),
      },
    ];
  });
}
