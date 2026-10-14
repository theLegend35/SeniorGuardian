import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import * as Speech from "expo-speech";
import { Mic, Volume2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { AppText } from "@/components/ui";
import { colors } from "@/lib/theme";

function heardHint(code: string) {
  if (code === "aborted" || code === "no-speech" || code === "speech-timeout") return null;
  if (code === "not-allowed") return "Allow the microphone to speak a question, or type instead.";
  if (code === "service-not-allowed" || code === "language-not-supported" || code === "audio-capture") {
    return "Speech recognition isn't available on this device. Type the question instead.";
  }
  return "I couldn't hear that. Check your microphone, or type instead.";
}

export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const onTextRef = useRef(onText);
  const listeningRef = useRef(false);
  onTextRef.current = onText;

  const mark = useCallback((value: boolean) => {
    listeningRef.current = value;
    setListening(value);
  }, []);

  useEffect(() => {
    const result = ExpoSpeechRecognitionModule.addListener("result", (event) => {
      if (!event.isFinal) return;
      const transcript = event.results[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      onTextRef.current(transcript);
      setHint("Added what you said. Check it before sending.");
    });
    const end = ExpoSpeechRecognitionModule.addListener("end", () => mark(false));
    const error = ExpoSpeechRecognitionModule.addListener("error", (event) => {
      mark(false);
      const next = heardHint(event.error);
      if (next) setHint(next);
    });
    return () => {
      result.remove();
      end.remove();
      error.remove();
      if (listeningRef.current) ExpoSpeechRecognitionModule.abort();
    };
  }, [mark]);

  const start = useCallback(async () => {
    if (listeningRef.current) return;
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setHint("Allow the microphone to speak a question, or type instead.");
      return;
    }
    setHint("Listening… speak now.");
    mark(true);
    ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: false });
  }, [mark]);

  const toggle = useCallback(async () => {
    if (listeningRef.current) {
      ExpoSpeechRecognitionModule.stop();
      mark(false);
      return;
    }
    await start();
  }, [mark, start]);

  return { listening, hint, start, toggle };
}

export function ReadAloudButton({ text, onDark = false }: { text: string; onDark?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const color = speaking ? (onDark ? colors.apricot400 : colors.apricot700) : onDark ? colors.white : colors.ink600;

  async function toggle() {
    if (await Speech.isSpeakingAsync()) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    const spoken = text.replace(/[•*]/g, " ").replace(/\s+/g, " ").trim();
    if (!spoken) return;
    setSpeaking(true);
    Speech.speak(spoken.slice(0, Speech.maxSpeechInputLength), {
      language: "en-US",
      rate: 0.92,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={speaking ? "Stop reading" : "Read aloud"} onPress={() => void toggle()} style={styles.read} hitSlop={6}>
      <Volume2 size={16} color={color} />
      <AppText size={13} weight="bold" color={color}>
        {speaking ? "Stop" : "Read aloud"}
      </AppText>
    </Pressable>
  );
}

export function MicButton({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? "Stop listening" : "Speak"}
      onPress={onPress}
      style={[styles.mic, listening && styles.micOn]}
    >
      <Mic size={18} color={listening ? colors.white : colors.brand800} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  read: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, paddingRight: 4 },
  mic: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand200 },
  micOn: { backgroundColor: colors.apricot, borderColor: colors.apricot },
});
