import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";

import { PhoneBridge } from "@/components/PhoneBridge";
import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function SplashGate({ fontsReady, children }: { fontsReady: boolean; children: ReactNode }) {
  const { ready } = useAuth();
  const open = ready && fontsReady;
  useEffect(() => {
    if (open) void SplashScreen.hideAsync();
  }, [open]);
  return open ? children : null;
}

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  return (
    <AuthProvider>
      <SplashGate fontsReady={loaded || Boolean(failed)}>
        <StatusBar style="dark" />
        <PhoneBridge />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
      </SplashGate>
    </AuthProvider>
  );
}
