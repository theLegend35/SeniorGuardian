import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import { loadActor } from "@/lib/records";
import { syncReminders } from "@/lib/reminders";
import { supabase, supabaseReady } from "@/lib/supabase";

/**
 * Refreshes this phone's reminders in the background, so a medicine stopped or changed on the website
 * (or by a clinician) stops ringing here even when nobody opens the app. Android runs it about every
 * 30 minutes when the phone allows; iOS decides when, often overnight. Opening the app still refreshes
 * right away. This module is imported by index.ts so the task exists when Android starts the app only
 * to run it.
 */
export const REMINDER_REFRESH_TASK = "sg-refresh-reminders";
const EVERY_MINUTES = 30;

type Modules = {
  tasks: typeof import("expo-task-manager");
  background: typeof import("expo-background-task");
};

function nativeModules(): Modules | null {
  if (Platform.OS === "web") return null;
  // A development build made before these modules were added has no native side. Then nothing runs in
  // the background and reminders refresh when the app opens, as before. Rebuild the app to turn this on.
  if (!requireOptionalNativeModule("ExpoTaskManager") || !requireOptionalNativeModule("ExpoBackgroundTask")) return null;
  try {
    return {
      tasks: require("expo-task-manager") as Modules["tasks"],
      background: require("expo-background-task") as Modules["background"],
    };
  } catch {
    return null;
  }
}

const loaded = nativeModules();

if (loaded) {
  loaded.tasks.defineTask(REMINDER_REFRESH_TASK, async () => {
    const { BackgroundTaskResult } = loaded.background;
    try {
      if (!supabaseReady) return BackgroundTaskResult.Success;
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return BackgroundTaskResult.Success;
      await syncReminders(await loadActor(userId));
      return BackgroundTaskResult.Success;
    } catch {
      return BackgroundTaskResult.Failed;
    }
  });
}

/** Turns the background refresh on after sign-in. Returns false when this phone or build cannot run it. */
export async function startBackgroundRefresh(): Promise<boolean> {
  if (!loaded) return false;
  try {
    const status = await loaded.background.getStatusAsync();
    if (status !== loaded.background.BackgroundTaskStatus.Available) return false;
    if (!(await loaded.tasks.isTaskRegisteredAsync(REMINDER_REFRESH_TASK))) {
      await loaded.background.registerTaskAsync(REMINDER_REFRESH_TASK, { minimumInterval: EVERY_MINUTES });
    }
    return true;
  } catch {
    return false;
  }
}

/** Turns it off at sign-out, so a signed-out phone does not keep checking. */
export async function stopBackgroundRefresh(): Promise<void> {
  if (!loaded) return;
  try {
    if (await loaded.tasks.isTaskRegisteredAsync(REMINDER_REFRESH_TASK)) {
      await loaded.background.unregisterTaskAsync(REMINDER_REFRESH_TASK);
    }
  } catch {
    // Nothing was registered.
  }
}
