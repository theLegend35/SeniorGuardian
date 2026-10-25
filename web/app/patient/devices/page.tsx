import { DeviceDesk } from "@/components/health/DeviceDesk";
import { MetricHistory } from "@/components/health/RecordCharts";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { cloudProvider, isCloudProvider, providerConfigured } from "@/lib/devices/catalog";
import { syncStoredDevice } from "@/lib/devices/pull";

export const metadata = { title: "Devices" };

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ link?: string; provider?: string }> }) {
  const query = await searchParams;
  const actor = await requireRole("patient");
  const store = await getStore();
  const patientId = actor.patientId!;
  let board = await store.getDeviceBoard(actor, patientId);
  if (!query.link) {
    for (const connection of board.connections) {
      if (!connection.linked || !isCloudProvider(connection.provider) || !providerConfigured(connection.provider)) continue;
      const newest = board.readings.find((reading) => reading.connectionId === connection.id);
      const stale = !newest || Date.now() - new Date(newest.recordedAt).getTime() > 20 * 60_000;
      if (!stale) continue;
      await syncStoredDevice(store, actor, connection.id).catch(() => undefined);
    }
    board = await store.getDeviceBoard(actor, patientId);
  }
  const account = isCloudProvider(query.provider ?? "") ? cloudProvider(query.provider!)!.account : "That account";
  const banners: Record<string, string> = {
    ready: `${account} is signed in. These are the latest numbers from that account.`,
    flagged: `${account} is signed in. A number is outside a saved range, so a notice was sent.`,
    outside: `${account} is signed in. A number is outside a saved range. A notice for it was already sent, or the day is not over yet.`,
    empty: `${account} is signed in. That account did not have a reading for the last day yet.`,
    connected: `${account} is signed in. Refresh the card if the numbers are not here yet.`,
    unconfigured: `${account}’s login page did not open. This server has no ${account} app yet, so ${account} will not show a sign-in page.`,
    failed: `${account} sign-in did not finish. Try again.`,
  };
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        eyebrow="Devices"
        title="Your devices"
        description="A device already on this account stays connected. Sign in only for a company that is not connected yet."
      />
      <DeviceDesk board={board} banner={query.link ? banners[query.link] : null} attention={query.provider} />
      <MetricHistory board={board} />
    </div>
  );
}
