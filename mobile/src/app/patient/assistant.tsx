import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import { AssistantChat } from "@/components/assistant";
import { Loading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { syncReminders } from "@/lib/reminders";
import { loadPatientAssistant, postPatientAssistant, type PatientAssistant } from "@/lib/web-api";

export default function PatientAssistantScreen() {
  const { actor } = useAuth();
  const params = useLocalSearchParams<{ listen?: string | string[] }>();
  const listen = (Array.isArray(params.listen) ? params.listen[0] : params.listen) === "1";
  const [data, setData] = useState<PatientAssistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await loadPatientAssistant();
      setData(next);
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
          audience="patient"
          configured={Boolean(data?.ai.configured)}
          modelLabel={data?.ai.label || "the saved record"}
          messages={data?.messages ?? []}
          labels={data?.labels}
          suggestions={data?.suggestions ?? ["What medicines do I take today?", "When is my next appointment?"]}
          medicines={data?.medicines}
          error={error}
          notice={notice}
          onAsk={async (question) => {
            setNotice(null);
            try {
              setData(await postPatientAssistant({ intent: "ask", question }));
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "The assistant could not answer.");
              void load();
              throw err;
            }
          }}
          onResolve={async (messageId, decision) => {
            setNotice(null);
            try {
              const next = await postPatientAssistant({ intent: "resolve", messageId, decision });
              setData(next);
              setNotice(next.notice ?? null);
              setError(null);
              if (decision === "confirm") await syncReminders(actor);
            } catch (err) {
              setError(err instanceof Error ? err.message : "That could not be saved.");
            }
          }}
          autoListen={listen}
          onClear={async () => {
            setNotice(null);
            try {
              setData(await postPatientAssistant({ intent: "clear" }));
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "The conversation could not be cleared.");
            }
          }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
