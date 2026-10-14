import { Redirect, Stack } from "expo-router";
import type { ReactNode } from "react";

import { Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";
import { homeFor, type Role } from "@/lib/types";

export const stackOptions = {
  headerStyle: { backgroundColor: colors.canvas },
  headerTintColor: colors.brand700,
  headerTitleStyle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink950 },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal" as const,
  contentStyle: { backgroundColor: colors.canvas },
};

export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { actor, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!actor) return <Redirect href="/" />;
  if (actor.role !== role) return <Redirect href={homeFor(actor.role)} />;
  return children;
}

export function RoleStack({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <RoleGate role={role}>
      <Stack screenOptions={stackOptions}>{children}</Stack>
    </RoleGate>
  );
}
