"use server";

import { revalidatePath } from "next/cache";

import { alarmCopy } from "@/lib/alarms/copy";
import type { DeliveredAlarm } from "@/lib/alarms/due";
import { requireActor } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export async function checkAlarmsAction(): Promise<{ fired: DeliveredAlarm[]; nextAt: string | null }> {
  const actor = await requireActor();
  if (actor.role === "doctor") return { fired: [], nextAt: null };
  const store = await getStore();
  const preview = await store.previewAlarms(actor);
  if (!preview.due.length) return { fired: [], nextAt: preview.nextAt };
  const drafts = await Promise.all(preview.due.map((alarm) => alarmCopy(alarm)));
  const fired = await store.deliverAlarms(actor, drafts);
  if (fired.length) {
    revalidatePath("/patient/dashboard");
    revalidatePath("/patient/assistant");
    revalidatePath("/patient/notifications");
    revalidatePath("/caregiver/dashboard");
    revalidatePath("/caregiver/notifications");
    revalidatePath("/caregiver/patients", "layout");
  }
  return { fired, nextAt: preview.nextAt };
}
