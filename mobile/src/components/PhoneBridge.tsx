import { router } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { useAuth } from "@/lib/auth";
import { mobilePath } from "@/lib/paths";
import { registerPushToken, syncReminders } from "@/lib/reminders";

function openNotification(url: unknown) {
  if (typeof url !== "string") return;
  const path = mobilePath(url);
  if (path) router.push(path as never);
}

export function PhoneBridge() {
  const { actor } = useAuth();

  useEffect(() => {
    if (!actor) return;
    void registerPushToken(actor.profileId);
    void syncReminders(actor);
  }, [actor]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && actor) void syncReminders(actor);
    });
    return () => sub.remove();
  }, [actor]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const response = Notifications.getLastNotificationResponse();
    if (response) openNotification(response.notification.request.content.data?.url);
    const sub = Notifications.addNotificationResponseReceivedListener((next) => {
      openNotification(next.notification.request.content.data?.url);
    });
    return () => sub.remove();
  }, []);

  return null;
}
