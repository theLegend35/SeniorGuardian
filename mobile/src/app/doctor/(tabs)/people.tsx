import { router } from "expo-router";
import { Search } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { PeoplePicker } from "@/components/Panels";
import { ErrorNote, Loading, PageHeader, Screen, TopBar, useAsync, useScale } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { listPeople } from "@/lib/records";
import { colors, fonts, shadows } from "@/lib/theme";

export default function DoctorPeople() {
  const { actor } = useAuth();
  const scale = useScale();
  const { data, error, loading, refreshing, refresh } = useAsync(() => listPeople(actor!), [actor?.profileId]);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const people = (data ?? []).filter((person) => !needle || `${person.name} ${person.detail}`.toLowerCase().includes(needle));

  return (
    <Screen top onRefresh={refresh} refreshing={refreshing}>
      <TopBar alertsHref="/doctor/alerts" />
      <PageHeader eyebrow={data ? `${data.length} authorized` : "Patients"} title="Patients" description="You see a patient only through an authorization they granted." />
      <View style={styles.search}>
        <Search size={18} color={colors.ink400} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search patients"
          placeholderTextColor={colors.ink400}
          style={[styles.input, { fontSize: Math.round(16.5 * scale) }]}
          autoCapitalize="none"
        />
      </View>
      <ErrorNote title="Could not load patients" body={error} />
      {loading ? <Loading /> : null}
      {!loading ? (
        <PeoplePicker
          people={people}
          empty={needle ? "No patient matches that search." : "When a patient grants you access from their care team, they appear here."}
          onPick={(id) => router.push(`/doctor/patient/${id}`)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    ...shadows.xs,
  },
  input: { flex: 1, minHeight: 50, color: colors.ink950, fontFamily: fonts.regular },
});
