import type { PermissionFlags } from "@/lib/data/types";
import { getStore } from "@/lib/data/index";
import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";
import type { Actor } from "@/types/domain";

export const dynamic = "force-dynamic";

const FLAG_KEYS = ["viewMedications", "viewAppointments", "viewTimeline", "viewConcerns", "viewReadings", "manageReminders"] as const;

export function OPTIONS() {
  return mobileOptions();
}

function flagsFrom(value: unknown): PermissionFlags | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const flags = {} as PermissionFlags;
  for (const key of FLAG_KEYS) {
    if (typeof source[key] !== "boolean") return null;
    flags[key] = source[key];
  }
  return flags;
}

async function teamFor(actor: Actor) {
  if (actor.role !== "patient" || !actor.patientId) return null;
  const chart = await (await getStore()).getChart(actor, actor.patientId);
  const team = chart.careTeam;
  return {
    doctors: (team?.doctors ?? []).filter((doctor) => doctor.status === "active").map((doctor) => ({
      linkId: doctor.linkId,
      name: doctor.name,
      specialty: doctor.specialty,
      clinic: doctor.clinic,
    })),
    caregivers: (team?.caregivers ?? []).filter((caregiver) => caregiver.status === "active").map((caregiver) => ({
      permissionId: caregiver.permissionId,
      name: caregiver.name,
      relationship: caregiver.relationship,
      flags: caregiver.flags,
    })),
  };
}

export function GET(request: Request) {
  return withMobileActor(request, async (actor) => {
    try {
      const team = await teamFor(actor);
      if (!team) return mobileJson({ error: "Only a patient can open the care team." }, 403);
      return mobileJson(team);
    } catch (error) {
      return mobileError(error);
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    intent?: string;
    email?: string;
    linkId?: string;
    permissionId?: string;
    flags?: unknown;
  } | null;
  return withMobileActor(request, async (actor) => {
    try {
      if (actor.role !== "patient" || !actor.patientId) return mobileJson({ error: "Only a patient can change the care team." }, 403);
      if (!body?.intent) return mobileJson({ error: "Say what to do." }, 400);
      const store = await getStore();
      let notice = "Saved.";
      if (body.intent === "authorize-doctor") {
        await store.authorizeDoctor(actor, String(body.email ?? ""));
        notice = "Access granted. That clinician can now see your record, and shared concerns only.";
      } else if (body.intent === "revoke-doctor") {
        await store.revokeDoctor(actor, String(body.linkId ?? ""));
        notice = "Access removed. That clinician can no longer open your record.";
      } else if (body.intent === "invite-caregiver") {
        await store.inviteCaregiver(actor, String(body.email ?? ""));
        notice = "Caregiver connected. Nothing is shared until you turn a permission on.";
      } else if (body.intent === "update-caregiver") {
        const flags = flagsFrom(body.flags);
        if (!flags || !body.permissionId) return mobileJson({ error: "Choose what that caregiver can see." }, 400);
        await store.updateCaregiverAccess(actor, String(body.permissionId), flags, false);
        notice = "Permissions saved.";
      } else if (body.intent === "revoke-caregiver") {
        const flags = flagsFrom(body.flags) ?? {
          viewMedications: false,
          viewAppointments: false,
          viewTimeline: false,
          viewConcerns: false,
          viewReadings: false,
          manageReminders: false,
        };
        await store.updateCaregiverAccess(actor, String(body.permissionId ?? ""), flags, true);
        notice = "Caregiver access removed.";
      } else {
        return mobileJson({ error: "Say what to do." }, 400);
      }
      const team = await teamFor(actor);
      return mobileJson({ ...team, notice });
    } catch (error) {
      return mobileError(error);
    }
  });
}
