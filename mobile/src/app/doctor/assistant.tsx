import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import { AssistantChat } from "@/components/assistant";
import { Loading, Screen } from "@/components/ui";
import { askClinicianWithFile, loadClinicianAssistant, postClinicianAssistant, type ClinicianAssistant, type PickedFile } from "@/lib/web-api";

export default function DoctorAssistantScreen() {
  const params = useLocalSearchParams<{ listen?: string | string[] }>();
  const listen = (Array.isArray(params.listen) ? params.listen[0] : params.listen) === "1";
  const [data, setData] = useState<ClinicianAssistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await loadClinicianAssistant();
      setData(next);
      setPatientId((current) => current || next.patients[0]?.patientId || "");
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

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf", "text/plain"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFileName(asset.name);
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, file: asset.file });
  }

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
          audience="clinician"
          configured={Boolean(data?.ai.configured)}
          modelLabel={data?.ai.label || "the saved record"}
          messages={data?.messages ?? []}
          suggestions={data?.suggestions ?? ["Who has a visit coming up?", "Draft a follow-up visit"]}
          patients={data?.patients}
          patientId={patientId}
          onPatient={setPatientId}
          attachmentName={fileName}
          onPickFile={() => void pick()}
          onRemoveFile={() => {
            setFile(null);
            setFileName(null);
          }}
          error={error}
          notice={notice}
          onAsk={async (question) => {
            setNotice(null);
            try {
              const next = file
                ? await askClinicianWithFile(question, patientId, file)
                : await postClinicianAssistant({ intent: "ask", question, patientId });
              setData(next);
              setFile(null);
              setFileName(null);
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
              const next = await postClinicianAssistant({ intent: "resolve", messageId, decision });
              setData(next);
              setNotice(next.notice ?? null);
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "That could not be saved.");
            }
          }}
          autoListen={listen}
          onClear={async () => {
            setNotice(null);
            try {
              setData(await postClinicianAssistant({ intent: "clear" }));
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
