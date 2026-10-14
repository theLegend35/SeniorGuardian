import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import { AssistantChat } from "@/components/assistant";
import { Loading, Screen } from "@/components/ui";
import { loadCaregiverAssistant, postCaregiverAssistant, type CaregiverAssistant } from "@/lib/web-api";

export default function CaregiverAssistantScreen() {
  const params = useLocalSearchParams<{ listen?: string | string[] }>();
  const listen = (Array.isArray(params.listen) ? params.listen[0] : params.listen) === "1";
  const [data, setData] = useState<CaregiverAssistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await loadCaregiverAssistant());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !data && !error) {
    return (
      <Screen>
        <Loading label="Opening the assistant" />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <AssistantChat
          audience="caregiver"
          configured={Boolean(data?.ai.configured)}
          modelLabel={data?.ai.label || "the shared record"}
          messages={data?.messages ?? []}
          suggestions={data?.suggestions ?? ["What morning medicines were shared?", "Who has a visit coming up?", "Where can I find a pharmacy?"]}
          error={error}
          notice={null}
          autoListen={listen}
          onAsk={async (question) => {
            const next = await postCaregiverAssistant({ intent: "ask", question });
            setData(next);
            setError(null);
          }}
          onResolve={async () => undefined}
          onClear={async () => {
            const next = await postCaregiverAssistant({ intent: "clear" });
            setData(next);
            setError(null);
          }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
