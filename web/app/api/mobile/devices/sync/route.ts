import { isCloudProvider } from "@/lib/devices/catalog";
import { syncStoredDevice } from "@/lib/devices/pull";
import { getStore } from "@/lib/data/index";
import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { provider?: string } | null;
  return withMobileActor(request, async (actor) => {
    try {
      if (actor.role !== "patient" || !actor.patientId) return mobileJson({ error: "Only a patient can connect a device." }, 403);
      const provider = String(body?.provider ?? "");
      if (!isCloudProvider(provider)) return mobileJson({ error: "Choose a device." }, 400);
      const store = await getStore();
      const board = await store.getDeviceBoard(actor, actor.patientId);
      const connection = board.connections.find((item) => item.provider === provider && item.linked) ?? board.connections.find((item) => item.provider === provider);
      if (!connection?.linked) return mobileJson({ error: "Sign in with that account first." }, 400);
      const result = await syncStoredDevice(store, actor, connection.id);
      return mobileJson({ count: result.count, outside: result.outside, alerted: result.alerted });
    } catch (error) {
      if (error instanceof Error && error.name !== "AccessError" && error.name !== "ValidationError") {
        return mobileJson({ error: error.message }, 400);
      }
      return mobileError(error);
    }
  });
}
