import { Stack } from "expo-router";

import { RoleStack } from "@/components/RoleStack";

const bare = { headerTitle: "" };

export default function PatientLayout() {
  return (
    <RoleStack role="patient">
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="medicine/[id]" options={{ title: "Medicine", ...bare }} />
      <Stack.Screen name="medicine/new" options={{ title: "Add a medicine", ...bare }} />
      <Stack.Screen name="visit/new" options={{ title: "Add a visit", ...bare }} />
      <Stack.Screen name="concerns" options={{ title: "Check a Health Concern", ...bare }} />
      <Stack.Screen name="concern/new" options={{ title: "Check a concern", ...bare }} />
      <Stack.Screen name="devices" options={{ title: "Rings and watches", ...bare }} />
      <Stack.Screen name="timeline" options={{ title: "Timeline", ...bare }} />
      <Stack.Screen name="health" options={{ title: "My health", ...bare }} />
      <Stack.Screen name="assistant" options={{ title: "Assistant", ...bare }} />
      <Stack.Screen name="finder" options={{ title: "Find care", ...bare }} />
      <Stack.Screen name="care-team" options={{ title: "Care team", ...bare }} />
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
      <Stack.Screen name="alerts" options={{ title: "Alerts", ...bare }} />
      <Stack.Screen name="settings" options={{ title: "Settings", ...bare }} />
      <Stack.Screen name="reminders" options={{ title: "Phone reminders", ...bare }} />
    </RoleStack>
  );
}
