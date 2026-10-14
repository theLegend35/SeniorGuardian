import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BellRing, Check, FileText, LogIn, ShieldCheck, Stethoscope, UserRound, Users, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Avatar, Badge, Button, Callout, Card, Field, Logo, type Tone } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, radius, shadows } from "@/lib/theme";
import { assistantHref, homeFor } from "@/lib/types";

const SAMPLES: Array<{ name: string; email: string; role: string; tone: Tone; icon: LucideIcon }> = [
  { name: "Eleanor Walsh", email: "eleanor.walsh@demo.seniorhelp.test", role: "Patient", tone: "brand", icon: UserRound },
  { name: "Dr. Marcus Hale", email: "marcus.hale@demo.seniorhelp.test", role: "Clinician", tone: "info", icon: Stethoscope },
  { name: "Helen Walsh", email: "helen.walsh@demo.seniorhelp.test", role: "Caregiver", tone: "apricot", icon: Users },
];

const POINTS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: BellRing, text: "Medicine and visit reminders ring even when the app is closed" },
  { icon: FileText, text: "The original label stays beside every reminder" },
  { icon: ShieldCheck, text: "You choose who sees what, and can change it any time" },
];

const PASSWORD = "Demo1234!";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function SignIn() {
  const { actor, configured, signIn } = useAuth();
  const params = useLocalSearchParams<{ next?: string | string[]; listen?: string | string[] }>();
  const openAssistant = first(params.next) === "assistant";
  const listen = first(params.listen) === "1";
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  if (actor) {
    const assistant = openAssistant ? assistantHref(actor.role, listen) : null;
    return <Redirect href={(assistant ?? homeFor(actor.role)) as Href} />;
  }

  const submit = async (key: string, nextEmail: string, nextPassword: string) => {
    setPending(key);
    setError(null);
    try {
      await signIn(nextEmail, nextPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 22 }]}>
          <View style={styles.glow} />
          <View style={styles.glowSmall} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Logo inverse />
            <Pressable accessibilityRole="button" accessibilityLabel="Back to the homepage" onPress={() => router.replace("/")} hitSlop={8}>
              <AppText size={15.5} weight="bold" color={colors.brand200}>
                Home
              </AppText>
            </Pressable>
          </View>
          <AppText size={30} weight="heavy" color={colors.white} style={{ marginTop: 26 }}>
            Care between visits, now on your phone.
          </AppText>
          <View style={{ gap: 12, marginTop: 18 }}>
            {POINTS.map((point) => (
              <View key={point.text} style={styles.point}>
                <View style={styles.pointIcon}>
                  <point.icon size={16} color={colors.apricot400} />
                </View>
                <AppText size={15.5} color="#d3efea" style={{ flex: 1 }}>
                  {point.text}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.body}>
          <Card style={{ marginTop: -36 }}>
            <View style={{ gap: 4 }}>
              <AppText size={26} weight="heavy" color={colors.ink950}>
                Welcome back
              </AppText>
              <AppText size={15.5} color={colors.ink600}>
                {openAssistant
                  ? "Sign in and the health assistant opens. You can speak with the microphone or type."
                  : "Sign in with the same email you use on the website."}
              </AppText>
            </View>
            {!configured ? (
              <Callout tone="warning" title="Supabase keys needed">
                Copy the public Supabase URL and publishable key into mobile/.env, then restart.
              </Callout>
            ) : null}
            {error ? (
              <Callout tone="danger" title="Could not sign in">
                {error}
              </Callout>
            ) : null}
            <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
            <Field label="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} placeholder="Your password" />
            <Button label="Sign in" icon={LogIn} size="lg" loading={pending === "form"} disabled={Boolean(pending)} onPress={() => void submit("form", email, password)} />
          </Card>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <AppText size={12.5} weight="bold" color={colors.ink500} style={{ letterSpacing: 1.4 }}>
              SAMPLE ACCOUNTS
            </AppText>
            <View style={styles.dividerLine} />
          </View>

          <View style={{ gap: 10 }}>
            {SAMPLES.map((account) => (
              <Pressable
                key={account.email}
                accessibilityRole="button"
                accessibilityLabel={`Sign in as ${account.name}`}
                disabled={Boolean(pending)}
                onPress={() => void submit(account.email, account.email, PASSWORD)}
                style={({ pressed }) => [styles.sample, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
              >
                <Avatar name={account.name} size={46} />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText size={16.5} weight="bold" color={colors.ink950}>
                    {account.name}
                  </AppText>
                  <AppText size={13.5} color={colors.ink500} lines={1}>
                    {account.email}
                  </AppText>
                </View>
                {pending === account.email ? (
                  <Badge tone="brand">Signing in…</Badge>
                ) : (
                  <Badge tone={account.tone} icon={account.icon}>
                    {account.role}
                  </Badge>
                )}
              </Pressable>
            ))}
          </View>

          <View style={styles.note}>
            <Check size={15} color={colors.ink400} style={{ marginTop: 2 }} />
            <AppText size={13.5} color={colors.ink500} style={{ flex: 1 }}>
              {`These are sample records, not real patients. Password: ${PASSWORD}. New accounts are created on the website so the role is set safely.`}
            </AppText>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.brand950, paddingHorizontal: 24, paddingBottom: 64, overflow: "hidden" },
  glow: { position: "absolute", top: -70, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(229,127,51,0.28)" },
  glowSmall: { position: "absolute", bottom: -40, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(20,121,108,0.35)" },
  point: { flexDirection: "row", alignItems: "center", gap: 12 },
  pointIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, gap: 18 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.lineStrong },
  sample: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadows.card,
  },
  note: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
});
