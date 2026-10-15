import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, Callout, Card, Field, Logo } from "@/components/ui";
import { colors } from "@/lib/theme";
import { supabase, supabaseReady, webUrl } from "@/lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const next = email.trim().toLowerCase();
    if (!EMAIL.test(next)) {
      setError("Enter the email on your account.");
      return;
    }
    if (!supabaseReady) {
      setError("Add the Supabase public keys to mobile/.env, then restart the app.");
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const redirectTo = webUrl ? `${webUrl}/auth/confirm` : undefined;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(next, redirectTo ? { redirectTo } : undefined);
      if (resetError) throw new Error("We could not send the reset email. Wait a minute and try again.");
      setNotice("If that email has an account, we sent a link to choose a new password. Open it, then come back and sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send the reset email.");
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={{ paddingTop: insets.top + 18, paddingHorizontal: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Logo />
            <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={() => router.back()} hitSlop={8}>
              <AppText size={15.5} weight="bold" color={colors.brand700}>
                Sign in
              </AppText>
            </Pressable>
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Card>
            <AppText size={26} weight="heavy" color={colors.ink950}>
              Reset your password
            </AppText>
            <AppText size={15.5} color={colors.ink600}>
              Enter the email on your account. The link opens the website, where you choose a new password.
            </AppText>
            {!supabaseReady ? (
              <Callout tone="warning" title="Supabase keys needed">
                Copy the public Supabase URL and publishable key into mobile/.env, then restart.
              </Callout>
            ) : null}
            {error ? (
              <Callout tone="danger" title="Could not send the link">
                {error}
              </Callout>
            ) : null}
            {notice ? (
              <Callout tone="success" title="Check your email">
                {notice}
              </Callout>
            ) : (
              <>
                <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
                <Button label="Send reset link" size="lg" loading={pending} disabled={pending} onPress={() => void submit()} />
              </>
            )}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
