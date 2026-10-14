import { Stack } from "expo-router";

import { RoleStack } from "@/components/RoleStack";

const bare = { headerTitle: "" };

export default function DoctorLayout() {
  return (
    <RoleStack role="doctor">
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="patient/[id]" options={{ title: "Patient", ...bare }} />
      <Stack.Screen name="assistant" options={{ title: "Assistant", ...bare }} />
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
      <Stack.Screen name="alerts" options={{ title: "Alerts", ...bare }} />
      <Stack.Screen name="settings" options={{ title: "Settings", ...bare }} />
      <Stack.Screen name="reminders" options={{ title: "Phone alerts", ...bare }} />
    </RoleStack>
  );
}
