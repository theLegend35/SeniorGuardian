import { Tabs, router, type Href } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HelpBar } from "@/components/HelpBar";
import { colors, fonts } from "@/lib/theme";

export type PortalTab = { name: string; title: string; icon: LucideIcon };

function TabIcon({ icon: Icon, focused }: { icon: LucideIcon; focused: boolean }) {
  return (
    <View style={[styles.pill, focused && styles.pillOn]}>
      <Icon size={21} color={focused ? colors.white : colors.ink500} strokeWidth={focused ? 2.3 : 2} />
    </View>
  );
}

export function PortalTabs({
  tabs,
  askHref,
}: {
  tabs: PortalTab[];
  askHref?: string;
}) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === "web" ? 8 : 10);
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand800,
        tabBarInactiveTintColor: colors.ink500,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line, height: 66 + bottom, paddingTop: 8, paddingBottom: bottom },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12, marginTop: 4 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarIcon: ({ focused }) => <TabIcon icon={tab.icon} focused={focused} /> }} />
      ))}
    </Tabs>
    <HelpBar
      bottom={74 + bottom}
      onAsk={askHref ? () => router.push(askHref as Href) : undefined}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { width: 54, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: colors.brand800 },
});
