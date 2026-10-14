import { router } from "expo-router";
import { EyeOff, HeartPulse, Plus, Sparkles, UsersRound } from "lucide-react-native";
import { View } from "react-native";

import { AppText, Badge, Button, Callout, Card, EmptyState, ErrorNote, Loading, PageHeader, Screen, SourceBlock, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listConcerns } from "@/lib/records";
import { colors } from "@/lib/theme";

export default function Concerns() {
  const { actor } = useAuth();
  const { data, error, loading, refreshing, refresh } = useAsync(() => listConcerns(actor?.patientId ?? ""), [actor?.patientId]);
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <PageHeader
        eyebrow="Your words first"
        title="Check a Health Concern"
        description="Describe what you notice. Your words stay visible beside any plain-language review. This is not a diagnosis."
        action={<Button label="Check a concern" icon={Plus} variant="apricot" inline onPress={() => router.push("/patient/concern/new")} />}
      />
      <ErrorNote title="Could not load concerns" body={error} />
      {loading ? <Loading /> : null}
      {!loading && data?.length === 0 ? <EmptyState icon={HeartPulse} title="No concerns yet" body="Write what you noticed, in your own words." /> : null}
      {data?.map((concern) => (
        <Card key={concern.id}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <AppText size={14} weight="bold" color={colors.ink500}>
              {formatDate(concern.createdAt)}
            </AppText>
            <Badge tone={concern.shared ? "brand" : "neutral"} icon={concern.shared ? UsersRound : EyeOff}>
              {concern.shared ? "Shared with care team" : "Only you"}
            </Badge>
          </View>
          <SourceBlock label="Your words">{concern.description}</SourceBlock>
          {concern.summary ? (
            <View style={{ gap: 6, borderRadius: 16, backgroundColor: colors.ai50, borderWidth: 1, borderColor: colors.ai200, padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} color={colors.ai700} />
                <AppText size={12.5} weight="bold" color={colors.ai700} style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                  Plain-language review
                </AppText>
              </View>
              <AppText size={15} color={colors.ink800}>
                {concern.summary}
              </AppText>
            </View>
          ) : (
            <AppText size={14} color={colors.ink500}>
              A review is added on the website when one is available. Your words are already saved.
            </AppText>
          )}
        </Card>
      ))}
      <Callout tone="danger" title="In an emergency, call 911">
        Senior Guardian is not an emergency service.
      </Callout>
    </Screen>
  );
}
