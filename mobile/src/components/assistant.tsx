import { router, type Href } from "expo-router";
import { Check, MessageCircleHeart, Paperclip, RotateCcw, SendHorizontal, ShieldAlert, Sparkles, X, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MicButton, ReadAloudButton, useDictation } from "@/components/speech";
import { AppText, Badge, Button, Callout, SourceBlock } from "@/components/ui";
import { formatTime, formatWhen } from "@/lib/format";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { AssistantLabel, AssistantMessage, ProposedAction } from "@/lib/web-api";

function confirmClear(onYes: () => void) {
  const message = "Clear this conversation? Saved medicines, reminders, notes, and files stay.";
  if (Platform.OS === "web") {
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert("New conversation", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: onYes },
  ]);
}

function describe(action: ProposedAction, audience: "patient" | "clinician" | "caregiver"): { icon: LucideIcon; title: string; detail: string } | null {
  if (audience === "caregiver") return null;
  if (action.type === "set_reminder" && audience === "patient") {
    return {
      icon: Check,
      title: `Add a reminder at ${formatTime(action.time)} for ${action.medicationName}?`,
      detail: `Only a reminder is added. Your prescription stays exactly as written: “${action.preservedInstructions}”`,
    };
  }
  if (action.type === "add_appointment") {
    const who = action.patientName ? ` for ${action.patientName}` : "";
    return {
      icon: Check,
      title: `Add ${audience === "clinician" ? "a visit" : "an appointment"} with ${action.provider}${who}?`,
      detail: [formatWhen(action.startsAt), action.specialty, action.location].filter(Boolean).join(" · "),
    };
  }
  if (action.type === "add_note") {
    return {
      icon: Check,
      title: action.patientName ? `Save this note on ${action.patientName}'s chart?` : "Save this note to your timeline?",
      detail: action.body,
    };
  }
  return null;
}

function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter((block) => block.trim());
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, index) => (
        <View key={index} style={{ gap: 4 }}>
          {block
            .split("\n")
            .filter((line) => line.trim())
            .map((line, lineIndex) => {
              const bullet = /^\s*[•\-*]\s+(.*)$/.exec(line);
              if (!bullet) {
                return (
                  <AppText key={lineIndex} size={16.5} color={colors.ink900}>
                    {line}
                  </AppText>
                );
              }
              return (
                <View key={lineIndex} style={{ flexDirection: "row", gap: 8 }}>
                  <AppText size={16} color={colors.ink700}>
                    •
                  </AppText>
                  <AppText size={16.5} color={colors.ink900} style={{ flex: 1 }}>
                    {bullet[1]}
                  </AppText>
                </View>
              );
            })}
        </View>
      ))}
    </View>
  );
}

function ActionCard({
  message,
  audience,
  pending,
  onResolve,
}: {
  message: AssistantMessage;
  audience: "patient" | "clinician" | "caregiver";
  pending: boolean;
  onResolve: (messageId: string, decision: "confirm" | "dismiss") => void;
}) {
  if (!message.proposedAction) return null;
  const info = describe(message.proposedAction, audience);
  if (!info) return null;
  return (
    <View style={styles.action}>
      <AppText size={16} weight="bold" color={colors.ink950}>
        {info.title}
      </AppText>
      <AppText size={14.5} color={colors.ink600}>
        {info.detail}
      </AppText>
      {message.actionStatus === "pending" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button label="Yes, save it" icon={Check} size="sm" inline loading={pending} onPress={() => onResolve(message.id, "confirm")} />
          <Button label={audience === "clinician" ? "Not now" : "No thanks"} icon={X} size="sm" variant="ghost" inline disabled={pending} onPress={() => onResolve(message.id, "dismiss")} />
        </View>
      ) : (
        <Badge tone={message.actionStatus === "confirmed" ? "success" : "neutral"}>{message.actionStatus === "confirmed" ? "Saved" : "Dismissed — nothing changed"}</Badge>
      )}
    </View>
  );
}

const RULES = [
  "Explain your saved labels and visit notes in plain words",
  "Suggest reminders, notes, and appointments — saved only if you confirm",
  "Never change a dose or tell you to stop a medicine",
  "Never diagnose. For emergencies, call 911",
];

export function AssistantChat({
  audience,
  configured,
  modelLabel,
  messages,
  labels,
  suggestions,
  medicines,
  patients,
  patientId,
  onPatient,
  attachmentName,
  onPickFile,
  onRemoveFile,
  onAsk,
  onResolve,
  onClear,
  error,
  notice,
  autoListen,
}: {
  audience: "patient" | "clinician" | "caregiver";
  configured: boolean;
  modelLabel: string;
  messages: AssistantMessage[];
  labels?: Record<string, AssistantLabel>;
  suggestions: string[];
  medicines?: Array<{ id: string; name: string; times: string[] }>;
  patients?: Array<{ patientId: string; fullName: string }>;
  patientId?: string;
  onPatient?: (id: string) => void;
  attachmentName?: string | null;
  onPickFile?: () => void;
  onRemoveFile?: () => void;
  onAsk: (question: string) => Promise<void>;
  onResolve: (messageId: string, decision: "confirm" | "dismiss") => Promise<void>;
  onClear: () => Promise<void>;
  error: string | null;
  notice: string | null;
  autoListen?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [value, setValue] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const voice = useDictation((text) => setValue((current) => (current ? `${current.trimEnd()} ${text}` : text)));
  const startedListen = useRef(false);

  useEffect(() => {
    if (!autoListen || startedListen.current) return;
    startedListen.current = true;
    void voice.start();
  }, [autoListen, voice.start]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: messages.length > 0 });
  }, [messages.length, asked, busy]);

  async function send(question: string) {
    const text = question.trim();
    if ((!text && !attachmentName) || busy) return;
    setBusy(true);
    setAsked(text);
    setValue("");
    try {
      await onAsk(text);
      setAsked("");
    } catch {
      setValue(text);
      setAsked("");
    } finally {
      setBusy(false);
    }
  }

  const status = configured ? `Connected to ${modelLabel}` : "Offline mode · answers from the saved record";

  async function resolve(messageId: string, decision: "confirm" | "dismiss") {
    setResolving(messageId);
    try {
      await onResolve(messageId, decision);
    } finally {
      setResolving(null);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.dot, { backgroundColor: configured ? colors.success600 : colors.apricot }]} />
            <AppText size={14} weight="semibold" color={colors.ink700} style={{ flex: 1 }}>
              {audience === "clinician" ? "Clinician assistant · authorized charts" : audience === "caregiver" ? "Caregiver assistant · shared sections" : "Health assistant"}
            </AppText>
          </View>
          <AppText size={13.5} color={colors.ink500}>
            {status}. {audience === "patient" ? "A dose never changes unless you confirm. In an emergency, call 911." : audience === "caregiver" ? "You see only what they shared. A dose never changes. In an emergency, call 911." : "Nothing is saved until you confirm, and a dose is never changed."}
          </AppText>
        </View>
        {messages.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel="New conversation" onPress={() => confirmClear(() => void onClear())} style={styles.clear}>
            <RotateCcw size={16} color={colors.ink700} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
        {messages.length === 0 && !busy ? (
          <View style={{ gap: 16 }}>
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
              <View style={styles.hero}>
                <MessageCircleHeart size={28} color={colors.white} />
              </View>
              <AppText size={26} weight="heavy" color={colors.ink950} style={{ textAlign: "center" }}>
                {audience === "clinician" ? "Ask about an authorized chart" : audience === "caregiver" ? "Ask about a shared record" : "How can I help today?"}
              </AppText>
              <AppText size={15.5} color={colors.ink600} style={{ textAlign: "center" }}>
                {audience === "clinician"
                  ? "Ask about visits, device numbers, or a saved record. Attach a photo, PDF, or text file. A visit or note is saved only if you confirm."
                  : audience === "caregiver"
                    ? "Medicines, visits, notes, and device numbers appear only when that person turned them on. Open Find care for a pharmacy or clinic nearby."
                    : "Ask about your saved medicines, upcoming visits, or what a word on your paperwork means. The original label stays next to the answer."}
              </AppText>
            </View>
            <View style={{ gap: 8 }}>
              {suggestions.map((item) => (
                <Pressable key={item} accessibilityRole="button" onPress={() => void send(item)} style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.9 }]}>
                  <AppText size={15.5} weight="semibold" color={colors.ink800}>
                    {item}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {audience === "patient" ? (
              <View style={styles.rules}>
                {RULES.map((rule, index) => (
                  <View key={rule} style={{ flexDirection: "row", gap: 8 }}>
                    {index < 2 ? <Check size={16} color={colors.success600} strokeWidth={3} /> : <X size={16} color={colors.danger600} strokeWidth={3} />}
                    <AppText size={14.5} color={colors.ink700} style={{ flex: 1 }}>
                      {rule}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
            {medicines?.length ? (
              <View style={{ gap: 8 }}>
                <AppText size={13} weight="bold" color={colors.ink500} style={{ letterSpacing: 0.6 }}>
                  MEDICINES I CAN SEE
                </AppText>
                {medicines.map((med) => (
                  <Pressable key={med.id} accessibilityRole="button" onPress={() => router.push(`/patient/medicine/${med.id}` as Href)} style={styles.suggestion}>
                    <AppText size={15.5} weight="bold" color={colors.ink950}>
                      {med.name}
                    </AppText>
                    <AppText size={13.5} color={colors.ink500}>
                      {med.times.map(formatTime).join(" · ") || "No reminder time yet"}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {messages.map((message) =>
              message.role === "user" ? (
                <View key={message.id} style={styles.userWrap}>
                  <View style={styles.userBubble}>
                    <AppText size={16} color={colors.white}>
                      {message.content}
                    </AppText>
                    <ReadAloudButton text={message.content} onDark />
                  </View>
                </View>
              ) : (
                <View key={message.id} style={[styles.answer, message.source === "safety" && styles.answerSafety]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={styles.answerMark}>
                      <MessageCircleHeart size={16} color={colors.white} />
                    </View>
                    {message.source === "safety" ? (
                      <Badge tone="danger" icon={ShieldAlert}>
                        Safety message
                      </Badge>
                    ) : message.source === "ai" ? (
                      <Badge tone="ai" icon={Sparkles}>
                        {configured ? "AI answer" : "Offline answer"}
                      </Badge>
                    ) : (
                      <Badge>From the saved record</Badge>
                    )}
                  </View>
                  <AnswerText text={message.content} />
                  <ReadAloudButton text={message.content} />
                  {(message.medicationIds ?? [])
                    .map((id) => labels?.[id])
                    .filter((item): item is AssistantLabel => Boolean(item))
                    .map((source) => (
                      <SourceBlock key={source.name} label={`Original label · ${source.name}`} meta={source.prescriber ? `Prescribed by ${source.prescriber}` : undefined}>
                        {source.text}
                      </SourceBlock>
                    ))}
                  <ActionCard message={message} audience={audience} pending={resolving === message.id} onResolve={(id, decision) => void resolve(id, decision)} />
                </View>
              ),
            )}
            {busy && asked ? (
              <View style={styles.userWrap}>
                <View style={[styles.userBubble, { opacity: 0.85 }]}>
                  <AppText size={16} color={colors.white}>
                    {asked}
                  </AppText>
                </View>
              </View>
            ) : null}
            {busy ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color={colors.brand700} />
                <AppText size={14.5} color={colors.ink500}>
                  Looking at the saved record…
                </AppText>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {error ? (
          <Callout tone="danger" title="Could not finish that">
            {error}
          </Callout>
        ) : null}
        {notice ? (
          <Callout tone="success" title={notice}>
            {notice === "Saved." ? "The record was updated. A dose was not changed." : "Nothing in the record was changed."}
          </Callout>
        ) : null}
        {patients?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {patients.map((patient) => {
              const on = patient.patientId === patientId;
              return (
                <Pressable key={patient.patientId} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onPatient?.(patient.patientId)} style={[styles.patient, on && styles.patientOn]}>
                  <AppText size={14} weight="bold" color={on ? colors.white : colors.ink800}>
                    {patient.fullName}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {attachmentName ? (
          <View style={styles.file}>
            <Paperclip size={14} color={colors.brand700} />
            <AppText size={14} weight="semibold" color={colors.ink800} style={{ flex: 1 }} lines={1}>
              {attachmentName}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove attachment" onPress={onRemoveFile}>
              <X size={16} color={colors.ink500} />
            </Pressable>
          </View>
        ) : null}
        {voice.hint ? (
          <AppText size={13} color={colors.ink500}>
            {voice.hint}
          </AppText>
        ) : null}
        <View style={styles.row}>
          {onPickFile ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Attach a file" onPress={onPickFile} style={styles.iconButton}>
              <Paperclip size={18} color={colors.ink700} />
            </Pressable>
          ) : null}
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={audience === "clinician" ? "Ask about an authorized patient" : audience === "caregiver" ? "Ask about a shared medicine or visit" : "Ask about a saved medicine or visit"}
            placeholderTextColor={colors.ink400}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => void send(value)}
            style={styles.input}
            accessibilityLabel="Question"
          />
          <MicButton listening={voice.listening} onPress={() => void voice.toggle()} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={busy || (!value.trim() && !attachmentName)}
            onPress={() => void send(value)}
            style={[styles.send, (busy || (!value.trim() && !attachmentName)) && { opacity: 0.45 }]}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <SendHorizontal size={18} color={colors.white} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  clear: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  thread: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  hero: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.brand700, alignItems: "center", justifyContent: "center", ...shadows.card },
  suggestion: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12, gap: 2, ...shadows.xs },
  rules: { gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14 },
  userWrap: { alignItems: "flex-end" },
  userBubble: { maxWidth: "88%", borderRadius: 18, borderTopRightRadius: 6, backgroundColor: colors.brand700, paddingHorizontal: 14, paddingVertical: 12 },
  answer: { gap: 10, borderRadius: 18, borderTopLeftRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14, ...shadows.xs },
  answerSafety: { borderColor: colors.danger200, backgroundColor: colors.danger50 },
  answerMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand700, alignItems: "center", justifyContent: "center" },
  action: { gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.brand200, backgroundColor: colors.brand50, padding: 12 },
  composer: { gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.canvas },
  patient: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8 },
  patientOn: { backgroundColor: colors.ink950, borderColor: colors.ink950 },
  file: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: colors.brand50, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: colors.ink950,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  iconButton: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  send: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand800 },
});
