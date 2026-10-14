import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { listMedicines, listPeople, listVisits, todayDoses } from "@/lib/records";
import { planReminders, type PlannedReminder, type ReminderPerson } from "@/lib/plan-reminders";
import { supabase } from "@/lib/supabase";
import type { Actor } from "@/lib/types";

const PREF = "sg.phoneReminders";
const memoryPref = { value: "on" };

export type UpcomingReminder = {
  id: string;
  at: string;
  title: string;
  kind: "dose" | "visit";
};

export type ReminderStatus = {
  permission: "granted" | "denied" | "undetermined" | "unavailable";
  enabled: boolean;
  scheduled: number;
  nextAt: string | null;
  capped: boolean;
  detail: string;
  upcoming: UpcomingReminder[];
};

let current: ReminderStatus = {
  permission: Platform.OS === "web" ? "unavailable" : "undetermined",
  enabled: true,
  scheduled: 0,
  nextAt: null,
  capped: false,
  detail: "Phone reminders have not been set up yet.",
  upcoming: [],
};

function upcomingFrom(reminders: PlannedReminder[]): UpcomingReminder[] {
  return reminders.slice(0, 8).map((reminder) => ({
    id: reminder.identifier,
    at: reminder.at.toISOString(),
    title: reminder.title,
    kind: reminder.identifier.startsWith("sg-visit") ? "visit" : "dose",
  }));
}
let savedToken = "";
const listeners = new Set<(status: ReminderStatus) => void>();

function publish(status: ReminderStatus) {
  current = status;
  for (const listener of listeners) listener(status);
}

export function subscribeReminders(listener: (status: ReminderStatus) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // The website preview and some simulators have no notification module.
}

async function readEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return memoryPref.value !== "off";
  const value = await Notifications.getPermissionsAsync()
    .then(() => import("expo-secure-store"))
    .then((store) => store.getItemAsync(PREF))
    .catch(() => null);
  return value !== "off";
}

async function writeEnabled(enabled: boolean) {
  if (Platform.OS === "web") {
    memoryPref.value = enabled ? "on" : "off";
    return;
  }
  const store = await import("expo-secure-store");
  await store.setItemAsync(PREF, enabled ? "on" : "off");
}

async function permissionState(): Promise<ReminderStatus["permission"]> {
  if (Platform.OS === "web") return "unavailable";
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return "granted";
  if (settings.status === "denied") return "denied";
  return "undetermined";
}

export async function requestReminderPermission(): Promise<ReminderStatus["permission"]> {
  if (Platform.OS === "web") return "unavailable";
  const settings = await Notifications.requestPermissionsAsync();
  return settings.granted ? "granted" : "denied";
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("reminders", {
    name: "Medicine and visit reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}

async function cancelScheduled() {
  if (Platform.OS === "web") return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((item) => item.identifier.startsWith("sg-")).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

async function reminderPeople(actor: Actor): Promise<ReminderPerson[]> {
  if (actor.role === "patient" && actor.patientId) {
    return [await onePerson(actor.patientId, actor.fullName, true, true, true)];
  }
  if (actor.role !== "caregiver") return [];
  const people = await listPeople(actor);
  const chosen = people.filter((person) => person.access.reminders || person.access.appointments);
  return Promise.all(
    chosen.map((person) => onePerson(person.patientId, person.name, false, person.access.reminders, person.access.appointments)),
  );
}

async function onePerson(patientId: string, patientName: string, self: boolean, medications: boolean, appointments: boolean): Promise<ReminderPerson> {
  const [medicines, doses, visits] = await Promise.all([
    medications ? listMedicines(patientId) : Promise.resolve([]),
    medications ? todayDoses(patientId) : Promise.resolve([]),
    appointments ? listVisits(patientId) : Promise.resolve([]),
  ]);
  return {
    patientId,
    patientName,
    self,
    medications,
    appointments,
    medicines,
    taken: doses.filter((dose) => dose.taken).map((dose) => `${dose.medicine.id}|${dose.scheduledFor}`),
    visits,
  };
}

export async function syncReminders(actor: Actor | null): Promise<ReminderStatus> {
  const enabled = await readEnabled();
  if (!actor) {
    const status: ReminderStatus = {
      permission: Platform.OS === "web" ? "unavailable" : await permissionState().catch(() => "undetermined"),
      enabled,
      scheduled: 0,
      nextAt: null,
      capped: false,
      detail: "Sign in to schedule reminders on this phone.",
      upcoming: [],
    };
    publish(status);
    return status;
  }
  if (actor.role === "doctor") {
    const status: ReminderStatus = {
      permission: Platform.OS === "web" ? "unavailable" : await permissionState(),
      enabled,
      scheduled: 0,
      nextAt: null,
      capped: false,
      detail: "Message alerts can arrive on this phone. Medicine reminders stay with the patient and caregivers who manage them.",
      upcoming: [],
    };
    publish(status);
    return status;
  }
  if (Platform.OS === "web") {
    const plan = await reminderPeople(actor)
      .then((people) => planReminders({ now: new Date(), people }))
      .catch(() => ({ reminders: [] as PlannedReminder[], capped: false }));
    const status: ReminderStatus = {
      permission: "unavailable",
      enabled,
      scheduled: 0,
      nextAt: plan.reminders[0]?.at.toISOString() ?? null,
      capped: plan.capped,
      detail: "This preview cannot ring. Open the app on an iPhone or Android phone and these times ring even when the screen is locked.",
      upcoming: upcomingFrom(plan.reminders),
    };
    publish(status);
    return status;
  }

  const permission = await permissionState();
  if (!enabled || permission !== "granted") {
    await cancelScheduled().catch(() => undefined);
    const status: ReminderStatus = {
      permission,
      enabled,
      scheduled: 0,
      nextAt: null,
      capped: false,
      detail: permission === "granted" ? "Phone reminders are paused on this device." : "Allow notifications so saved medicine and visit times can ring on this phone.",
      upcoming: [],
    };
    publish(status);
    return status;
  }

  try {
    await ensureChannel();
    const plan = planReminders({ now: new Date(), people: await reminderPeople(actor) });
    await cancelScheduled();
    for (const reminder of plan.reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: {
          title: reminder.title,
          body: reminder.body,
          sound: "default",
          data: { url: reminder.href },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: "reminders" },
      });
    }
    const status: ReminderStatus = {
      permission,
      enabled: true,
      scheduled: plan.reminders.length,
      nextAt: plan.reminders[0]?.at.toISOString() ?? null,
      capped: plan.capped,
      detail: plan.reminders.length
        ? "This phone will ring at the saved times even when the app is closed. The label text is included, and the dose is not changed."
        : "No upcoming reminders are saved. Add a time on a medicine, or turn a visit reminder on.",
      upcoming: upcomingFrom(plan.reminders),
    };
    publish(status);
    return status;
  } catch (error) {
    const status: ReminderStatus = {
      permission,
      enabled,
      scheduled: 0,
      nextAt: null,
      capped: false,
      detail: error instanceof Error ? error.message : "Reminders could not be scheduled.",
      upcoming: [],
    };
    publish(status);
    return status;
  }
}

export async function setPhoneReminders(actor: Actor, enabled: boolean): Promise<void> {
  await writeEnabled(enabled);
  if (enabled) await requestReminderPermission();
  await syncReminders(actor);
}

export async function sendTestReminder(): Promise<void> {
  if (Platform.OS === "web") throw new Error("A test reminder needs the iPhone or Android app.");
  const permission = await requestReminderPermission();
  if (permission !== "granted") throw new Error("Allow notifications to hear a test reminder.");
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: `sg-test-${Date.now()}`,
    content: {
      title: "Senior Guardian",
      body: "This is a test reminder. Medicine reminders use the saved label and do not change the dose.",
      sound: "default",
      data: { url: "/patient/reminders" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: "reminders" },
  });
}

export async function registerPushToken(profileId: string): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;
  const permission = await permissionState();
  if (permission !== "granted") return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    savedToken = token;
    await supabase.from("device_push_tokens").upsert(
      { profile_id: profileId, token, platform: Platform.OS === "ios" ? "ios" : "android", updated_at: new Date().toISOString() },
      { onConflict: "profile_id,token" },
    );
  } catch {
    // Local reminders still ring without a push token.
  }
}

export async function forgetThisPhone(): Promise<void> {
  if (savedToken) {
    await supabase.from("device_push_tokens").delete().eq("token", savedToken);
    savedToken = "";
  }
  await cancelScheduled().catch(() => undefined);
}
