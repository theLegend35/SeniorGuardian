import { Stack } from "expo-router";

import { RoleStack } from "@/components/RoleStack";

const bare = { headerTitle: "" };

export default function CaregiverLayout() {
  return (
    <RoleStack role="caregiver">
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="person/[id]" options={{ title: "Shared record", ...bare }} />
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
      <Stack.Screen name="assistant" options={{ title: "Assistant" }} />
      <Stack.Screen name="finder" options={{ title: "Find care" }} />
      <Stack.Screen name="alerts" options={{ title: "Alerts", ...bare }} />
      <Stack.Screen name="settings" options={{ title: "Settings", ...bare }} />
    </RoleStack>
  );
}
