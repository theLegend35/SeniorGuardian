import type { AppNotification } from "@/types/domain";

import { supabaseConfigured } from "@/lib/supabase/env";

type Delivery = Pick<AppNotification, "profileId" | "title" | "body" | "kind" | "href">;

export interface NotificationChannel {
  readonly name: string;
  deliver(notification: Delivery): Promise<void>;
}

export const inAppChannel: NotificationChannel = {
  name: "in-app",
  async deliver() {
    // The health record store writes the notification row. This channel marks that delivery as in-app.
  },
};

export const mobilePushChannel: NotificationChannel = {
  name: "mobile-push",
  async deliver(notification) {
    if (!supabaseConfigured()) return;
    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.from("device_push_tokens").select("token").eq("profile_id", notification.profileId);
      if (error || !data?.length) return;
      const messages = data
        .map((row) => String((row as { token?: string }).token ?? ""))
        .filter(Boolean)
        .map((token) => ({
          to: token,
          title: notification.title,
          body: notification.body,
          sound: "default",
          data: { url: notification.href },
        }));
      if (!messages.length) return;
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // A missing token table or a phone that is offline must not block the in-app notice.
    }
  },
};

export async function fanOut(notification: Delivery): Promise<void> {
  await inAppChannel.deliver(notification);
  await mobilePushChannel.deliver(notification);
}
