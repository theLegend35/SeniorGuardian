import { router, type Href } from "expo-router";
import { BellRing, Check, Phone, ShieldCheck } from "lucide-react-native";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HelpBar } from "@/components/HelpBar";
import { AppText, Logo, LogoMark } from "@/components/ui";
import { webUrl } from "@/lib/supabase";
import { colors, radius, shadows } from "@/lib/theme";

const FACTS = [
  { icon: BellRing, title: "Reminders ring here", body: "Medicine and visit times sound on this phone, even when the app is closed." },
  { icon: ShieldCheck, title: "The label stays", body: "An answer sits beside the original prescription. A dose changes only if you confirm it." },
  { icon: Phone, title: "Emergencies stop the chat", body: "If the words sound urgent, the assistant tells you to call 911." },
];

function openAssistant() {
  router.push("/sign-in?next=assistant" as Href);
}

export function MarketingHome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
          <Logo />
          <Pressable accessibilityRole="button" onPress={() => router.push("/sign-in")} hitSlop={8}>
            <AppText size={16} weight="bold" color={colors.brand800}>
              Sign in
            </AppText>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <AppText size={13} weight="bold" color={colors.apricot400} style={{ letterSpacing: 1.2 }}>
            ON THIS PHONE
          </AppText>
          <AppText size={32} weight="heavy" color={colors.white} style={{ marginTop: 8 }}>
            Ask about your record out loud.
          </AppText>
          <AppText size={16.5} color="#d3efea" style={{ marginTop: 10 }}>
            Medicines, visits, and concerns live here. Chat opens the health assistant. You can speak once you are there.
          </AppText>
          <View style={styles.notice}>
            <LogoMark size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText size={12.5} weight="bold" color={colors.ink500}>
                Senior Guardian · now
              </AppText>
              <AppText size={15.5} weight="bold" color={colors.ink950}>
                Time for Metformin 500 mg
              </AppText>
              <AppText size={13.5} color={colors.ink600}>
                The reminder repeats the saved label. It does not change the dose.
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.list}>
          {FACTS.map((fact) => (
            <View key={fact.title} style={styles.fact}>
              <View style={styles.factIcon}>
                <fact.icon size={20} color={colors.brand800} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText size={16.5} weight="bold" color={colors.ink950}>
                  {fact.title}
                </AppText>
                <AppText size={14.5} color={colors.ink600}>
                  {fact.body}
                </AppText>
              </View>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => router.push("/sign-in")} style={styles.signCard}>
            <Check size={18} color={colors.brand700} strokeWidth={3} />
            <AppText size={16} weight="bold" color={colors.ink950} style={{ flex: 1 }}>
              Sign in to today’s medicines, visits, and Find care
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (webUrl) void Linking.openURL(`${webUrl}/signup`);
            }}
            style={{ paddingVertical: 4 }}
          >
            <AppText size={14.5} color={colors.ink500}>
              New accounts are created on the website, so the role is set safely.
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <HelpBar bottom={Math.max(insets.bottom, 12)} onAsk={openAssistant} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: { paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hero: { marginHorizontal: 16, marginTop: 8, borderRadius: 28, backgroundColor: colors.brand950, padding: 20, overflow: "hidden" },
  notice: { marginTop: 18, flexDirection: "row", gap: 12, borderRadius: 18, backgroundColor: colors.white, padding: 12 },
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  fact: { flexDirection: "row", gap: 12, alignItems: "flex-start", borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 14, ...shadows.xs },
  factIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
  signCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.lg, backgroundColor: colors.brand50, padding: 14 },
});
