import { router, type Href } from "expo-router";
import { AlarmClock, Bell, BellRing, CalendarDays, Check, Languages, LogOut, MessageSquare, Pill, Send, Smartphone, Type, UserRound } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AiSettingsCard } from "@/components/AiSettings";
import { useReminderStatus } from "@/components/records";
import { MicButton, ReadAloudButton, useDictation } from "@/components/speech";
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Chip,
  EmptyState,
  ErrorNote,
  IconTile,
  ListGroup,
  ListRow,
  Loading,
  PageHeader,
  Screen,
  Segmented,
  SwitchRow,
  Field,
  TopBar,
  useAsync,
  useScale,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { clock, formatDate, relativeDay, timeAgo } from "@/lib/format";
import { mobilePath } from "@/lib/paths";
import { listMessages, listNotices, markChatRead, markNoticeRead, sendMessage, updateProfile } from "@/lib/records";
import { exactAlarmSettingApplies, openExactAlarmSettings, sendTestReminder, setPhoneReminders, subscribePush, type PushState } from "@/lib/reminders";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import { useSpanish } from "@/lib/translate";
import type { Access, PersonCard, Role, TextScale } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { patient: "Patient", doctor: "Clinician", caregiver: "Caregiver" };

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// ---------- Alerts ----------

export function AlertsScreen() {
  const { data, error, loading, reload } = useAsync(listNotices, []);
  const unread = (data ?? []).filter((notice) => !notice.read).length;
  return (
    <Screen>
      <PageHeader
        eyebrow={unread ? `${unread} unread` : "All caught up"}
        title="Alerts"
        description="Today's messages and reminders. Medicine reminders also ring on this phone when the app is closed."
      />
      <ErrorNote title="Could not load alerts" body={error} />
      {loading ? <Loading /> : null}
      {!loading && data?.length === 0 ? <EmptyState icon={Bell} title="No alerts today" body="Medicine and visit reminders show up here on the day they are sent." /> : null}
      {data?.length ? (
        <Card padded={false} style={{ paddingVertical: 4 }}>
          {data.map((notice, index) => (
            <View key={notice.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void markNoticeRead(notice.id).then(reload);
                  const path = mobilePath(notice.href);
                  if (path) router.push(path as Href);
                }}
                style={({ pressed }) => [styles.notice, pressed && { backgroundColor: colors.canvas }]}
              >
                <IconTile icon={notice.title.toLowerCase().includes("message") ? MessageSquare : Bell} tone={notice.read ? "neutral" : "brand"} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AppText size={16} weight="bold" color={colors.ink950} style={{ flex: 1 }}>
                      {notice.title}
                    </AppText>
                    {!notice.read ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <AppText size={14.5} color={colors.ink600}>
                    {notice.body}
                  </AppText>
                  <AppText size={13} color={colors.ink400}>
                    {timeAgo(notice.createdAt)}
                  </AppText>
                </View>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

// ---------- Settings ----------

const remindersHref: Record<Role, Href> = { patient: "/patient/reminders", doctor: "/doctor/reminders", caregiver: "/caregiver/reminders" };

export function SettingsScreen() {
  const { actor, signOut, refresh } = useAuth();
  const [name, setName] = useState(actor?.fullName ?? "");
  const [phone, setPhone] = useState(actor?.phone ?? "");
  const [scale, setScale] = useState<TextScale>(actor?.textScale ?? "default");
  const [locale, setLocale] = useState<"en" | "es">(actor?.locale === "es" ? "es" : "en");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const say = useSpanish(locale === "es", [
    "Settings",
    "Your name, phone, language, and how large text looks in this app.",
    "Could not save",
    "Saved",
    "Your name, phone, language, and text size are updated.",
    "Profile",
    "Name",
    "Phone",
    "Language",
    "Pages, menus, and buttons use the language you choose. Prescription text stays as it was saved.",
    "Text size",
    "Applies across this app.",
    "Default",
    "Large",
    "Largest",
    "Save changes",
    "This phone",
    "Phone alerts",
    "Phone reminders",
    "What rings here, and a test reminder",
    "Sign out",
    "In an emergency, call 911. Senior Guardian is not an emergency service.",
  ]);
  if (!actor) return null;

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile(actor.profileId, { fullName: name, phone, textScale: scale, locale });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(errorText(err, "Settings could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageHeader title={say("Settings")} description={say("Your name, phone, language, and how large text looks in this app.")} />

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={actor.fullName} size={58} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText size={19} weight="heavy" color={colors.ink950}>
            {actor.fullName}
          </AppText>
          <AppText size={14} color={colors.ink500} lines={1}>
            {actor.email}
          </AppText>
          <Badge tone="brand">{ROLE_LABEL[actor.role]}</Badge>
        </View>
      </Card>

      {error ? (
        <Callout tone="danger" title={say("Could not save")}>
          {error}
        </Callout>
      ) : null}
      {saved ? (
        <Callout tone="success" title={say("Saved")}>
          {say("Your name, phone, language, and text size are updated.")}
        </Callout>
      ) : null}

      <Card>
        <CardHeader icon={UserRound} title={say("Profile")} />
        <Field label={say("Name")} value={name} onChangeText={setName} />
        <Field label={say("Phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" optional />
      </Card>

      <Card>
        <CardHeader icon={Languages} title={say("Language")} description={say("Pages, menus, and buttons use the language you choose. Prescription text stays as it was saved.")} />
        <Segmented
          options={[
            { value: "en", label: "English" },
            { value: "es", label: "Español" },
          ]}
          value={locale}
          onChange={setLocale}
        />
      </Card>

      <Card>
        <CardHeader icon={Type} title={say("Text size")} description={say("Applies across this app.")} />
        <Segmented
          options={[
            { value: "default", label: say("Default") },
            { value: "large", label: say("Large") },
            { value: "largest", label: say("Largest") },
          ]}
          value={scale}
          onChange={setScale}
        />
      </Card>

      <AiSettingsCard />

      <Button label={say("Save changes")} icon={Check} loading={saving} onPress={() => void save()} />

      <ListGroup title={say("This phone")}>
        <ListRow icon={BellRing} title={say(actor.role === "doctor" ? "Phone alerts" : "Phone reminders")} body={say("What rings here, and a test reminder")} href={remindersHref[actor.role]} />
      </ListGroup>

      <Button label={say("Sign out")} icon={LogOut} variant="danger" onPress={() => void signOut()} />
      <AppText size={13.5} color={colors.ink500} align="center">
        {say("In an emergency, call 911. Senior Guardian is not an emergency service.")}
      </AppText>
    </Screen>
  );
}

// ---------- Phone reminders ----------

const PUSH_TEXT: Record<PushState, string> = {
  on: "Care-team alerts are on. Messages and notices from the care team can arrive on this phone.",
  "needs-setup": "Care-team alerts are not set up in this build of the app yet, so messages and notices show inside the app. Medicine reminders still ring.",
  off: "Care-team alerts need notification permission on this phone.",
  unavailable: "Care-team alerts need the iPhone or Android app on a real phone.",
  failed: "Care-team alerts could not be turned on for this phone. Medicine reminders still ring.",
};

function usePushState(): PushState {
  const [state, setState] = useState<PushState>("off");
  useEffect(() => subscribePush(setState), []);
  return state;
}

/** Pass `alertsHref` when this screen is a tab, so it gets the top bar. */
export function RemindersScreen({ alertsHref }: { alertsHref?: Href } = {}) {
  const { actor } = useAuth();
  const status = useReminderStatus();
  const push = usePushState();
  const [error, setError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  if (!actor) return null;

  const doctor = actor.role === "doctor";
  const web = status?.permission === "unavailable";
  const live = Boolean(status?.enabled && status.permission === "granted");
  const upcoming = status?.upcoming ?? [];
  const stateLabel = web ? "Preview" : live ? "On" : status?.enabled === false ? "Paused" : "Needs permission";

  const toggle = (next: boolean) => {
    setError(null);
    void setPhoneReminders(actor, next).catch((err: unknown) => setError(errorText(err, "Could not update reminders.")));
  };
  const test = () => {
    setError(null);
    setTestSent(false);
    void sendTestReminder()
      .then(() => setTestSent(true))
      .catch((err: unknown) => setError(errorText(err, "The test could not be sent.")));
  };

  return (
    <Screen top={Boolean(alertsHref)}>
      {alertsHref ? <TopBar alertsHref={alertsHref} /> : null}
      <PageHeader
        eyebrow="On this phone"
        title={doctor ? "Phone alerts" : "Phone reminders"}
        description={
          doctor
            ? "Message alerts can arrive on this phone. Medicine reminders stay with the patient and the caregivers who manage them."
            : "The website can only chime while a tab is open. This app schedules the same saved times on the phone, so they ring when the screen is locked."
        }
      />

      <View style={styles.status}>
        <View style={styles.statusGlow} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconTile icon={BellRing} tone="dark" size={50} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText size={12.5} weight="bold" color={colors.brand200} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
              {doctor ? "Alerts" : "Reminders"}
            </AppText>
            <AppText size={22} weight="heavy" color={colors.white}>
              {doctor ? "Messages and visit changes" : live ? `${status?.scheduled ?? 0} scheduled` : web ? (upcoming.length ? `Next ${upcoming.length} planned` : "Nothing planned") : stateLabel}
            </AppText>
          </View>
          <View style={styles.statePill}>
            <View style={[styles.stateDot, { backgroundColor: live ? "#5ee0a0" : web ? colors.apricot400 : colors.ink400 }]} />
            <AppText size={13} weight="bold" color={colors.white}>
              {stateLabel}
            </AppText>
          </View>
        </View>
        <AppText size={15} color="#d3efea">
          {status?.detail ?? "Checking this phone…"}
        </AppText>
        {status?.capped ? (
          <AppText size={13.5} color={colors.brand200}>
            Later reminders are added the next time you open the app.
          </AppText>
        ) : null}
      </View>

      {error ? (
        <Callout tone="danger" title="Reminder">
          {error}
        </Callout>
      ) : null}
      {testSent ? (
        <Callout tone="success" title="Test scheduled">
          Lock the phone. A test reminder rings in about 5 seconds.
        </Callout>
      ) : null}

      <Card>
        {!doctor ? (
          <SwitchRow
            label="Ring reminders on this phone"
            description="Medicine times and visit reminders, even when the app is closed."
            value={web ? Boolean(status?.enabled) : live}
            onChange={toggle}
          />
        ) : null}
        <Button label="Send a test reminder" icon={Smartphone} variant="secondary" onPress={test} />
        {web ? (
          <AppText size={13.5} color={colors.ink500}>
            A test needs the iPhone or Android app. The browser preview cannot ring.
          </AppText>
        ) : null}
        <AppText size={13.5} color={colors.ink500}>
          {PUSH_TEXT[push]}
        </AppText>
      </Card>

      {!doctor && live && exactAlarmSettingApplies() ? (
        <Card>
          <CardHeader
            icon={AlarmClock}
            title="Ring on the minute"
            description="Android can hold a reminder for a few minutes to save battery. Allow Alarms & reminders for Senior Guardian so reminders ring on time."
          />
          <Button
            label="Open Alarms & reminders"
            icon={AlarmClock}
            variant="secondary"
            onPress={() => void openExactAlarmSettings().catch((err: unknown) => setError(errorText(err, "That setting could not open.")))}
          />
        </Card>
      ) : null}

      {!doctor ? (
        <Card>
          <CardHeader icon={CalendarDays} title="Coming up on this phone" description="The next times that will ring." />
          {upcoming.length === 0 ? (
            <EmptyState icon={BellRing} title="Nothing to ring yet" body="Add a time on a medicine, or turn a visit reminder on." />
          ) : (
            <View>
              {upcoming.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <View style={[styles.rowDivider, { marginLeft: 54 }]} /> : null}
                  <View style={styles.upcoming}>
                    <IconTile icon={item.kind === "visit" ? CalendarDays : Pill} tone={item.kind === "visit" ? "info" : "ai"} size={40} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <AppText size={15.5} weight="bold" color={colors.ink950}>
                        {item.title}
                      </AppText>
                      <AppText size={14} color={colors.ink500}>
                        {`${relativeDay(item.at)} · ${clock(item.at)}`}
                      </AppText>
                    </View>
                    {index === 0 ? <Badge tone="brand">Next</Badge> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader icon={Check} title="How it works" />
        {(doctor
          ? ["You get an alert when a patient or caregiver messages you.", "Open the alert to go straight to the conversation.", "Patients' medicine reminders never ring on your phone."]
          : [
              "Add or change a time on the website or here. This phone picks it up when the app opens, and in the background when the phone allows it.",
              "Each reminder repeats the saved label word for word. It does not change a dose.",
              "Doses already marked taken are skipped. The next 7 days are kept on the phone.",
            ]
        ).map((text, index) => (
          <View key={text} style={styles.step}>
            <View style={styles.stepNumber}>
              <AppText size={13} weight="heavy" color={colors.brand800}>
                {String(index + 1)}
              </AppText>
            </View>
            <AppText size={15} color={colors.ink700} style={{ flex: 1 }}>
              {text}
            </AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

// ---------- Chat ----------

export function ChatScreen({ patientId, title, subtitle }: { patientId: string; title?: string; subtitle?: string }) {
  const { actor } = useAuth();
  const scale = useScale();
  const scroller = useRef<ScrollView>(null);
  const { data, error, loading, reload } = useAsync(async () => {
    const messages = await listMessages(patientId);
    void markChatRead(patientId).catch(() => undefined);
    return messages;
  }, [patientId]);
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const voice = useDictation((text) => setBody((current) => (current ? `${current.trimEnd()} ${text}` : text)));
  if (!actor) return null;

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(actor, patientId, body.trim());
      setBody("");
      reload();
    } catch (err) {
      setSendError(errorText(err, "The message could not be sent."));
    } finally {
      setSending(false);
    }
  };

  let lastDay = "";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <ScrollView ref={scroller} contentContainerStyle={styles.thread} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
          <View style={styles.chatHead}>
            <IconTile icon={MessageSquare} tone="brand" size={44} />
            <View style={{ flex: 1, gap: 1 }}>
              <AppText size={18} weight="heavy" color={colors.ink950}>
                {title ?? "Care team chat"}
              </AppText>
              <AppText size={14} color={colors.ink500}>
                {subtitle ?? "Saved to the same record the website uses."}
              </AppText>
            </View>
          </View>
          <Callout tone="warning" title="Not for emergencies">
            Replies can take time. If something is urgent, call 911.
          </Callout>
          <ErrorNote title="Could not load messages" body={error} />
          {loading ? <Loading /> : null}
          {!loading && data?.length === 0 ? <EmptyState icon={MessageSquare} title="No messages yet" body="Start the conversation below." /> : null}
          {data?.map((message) => {
            const mine = message.authorId === actor.profileId;
            const day = formatDate(message.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <View key={message.id} style={{ gap: 8 }}>
                {showDay ? (
                  <AppText size={12.5} weight="bold" color={colors.ink400} align="center" style={{ letterSpacing: 0.6, marginTop: 6 }}>
                    {day}
                  </AppText>
                ) : null}
                <View style={[styles.messageRow, mine && { flexDirection: "row-reverse" }]}>
                  {!mine ? <Avatar name={message.authorName} size={34} /> : null}
                  <View style={{ maxWidth: "80%", gap: 4, alignItems: mine ? "flex-end" : "flex-start" }}>
                    {!mine ? (
                      <AppText size={12.5} weight="bold" color={colors.ink500}>
                        {`${message.authorName} · ${ROLE_LABEL[message.authorRole]}`}
                      </AppText>
                    ) : null}
                    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                      <AppText size={16} color={mine ? colors.white : colors.ink950}>
                        {message.body}
                      </AppText>
                      <ReadAloudButton text={message.body} onDark={mine} />
                    </View>
                    <AppText size={12} color={colors.ink400}>
                      {clock(message.createdAt)}
                    </AppText>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
        {sendError ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
            <AppText size={14} color={colors.danger700}>
              {sendError}
            </AppText>
          </View>
        ) : null}
        {voice.hint ? (
          <AppText size={13} color={colors.ink500} style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            {voice.hint}
          </AppText>
        ) : null}
        <View style={styles.composer}>
          <MicButton listening={voice.listening} onPress={() => void voice.toggle()} />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write a message"
            placeholderTextColor={colors.ink400}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => void send()}
            style={[styles.composerInput, { fontSize: Math.round(16.5 * scale) }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => void send()}
            disabled={sending || !body.trim()}
            style={({ pressed }) => [styles.send, (!body.trim() || sending) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            <Send size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- People ----------

const ACCESS_LABEL: Array<[keyof Access, string]> = [
  ["medications", "Medicines"],
  ["reminders", "Reminders"],
  ["appointments", "Visits"],
  ["concerns", "Concerns"],
  ["readings", "Readings"],
  ["timeline", "Timeline"],
];

export function AccessChips({ access }: { access: Access }) {
  const shared = ACCESS_LABEL.filter(([key]) => access[key]);
  if (!shared.length) {
    return <Chip tone="neutral">Nothing shared yet</Chip>;
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {shared.map(([key, label]) => (
        <Chip key={key} icon={Check}>
          {label}
        </Chip>
      ))}
    </View>
  );
}

export function PeoplePicker({ people, onPick, empty, showAccess = false }: { people: PersonCard[]; onPick: (id: string) => void; empty: string; showAccess?: boolean }) {
  if (!people.length) return <EmptyState icon={UserRound} title="No one yet" body={empty} />;
  return (
    <View style={{ gap: 12 }}>
      {people.map((person) => (
        <Pressable
          key={person.patientId}
          accessibilityRole="button"
          onPress={() => onPick(person.patientId)}
          style={({ pressed }) => [styles.person, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar name={person.name} size={50} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText size={17.5} weight="bold" color={colors.ink950}>
                {person.name}
              </AppText>
              {person.detail ? (
                <AppText size={14.5} color={colors.ink500}>
                  {person.detail}
                </AppText>
              ) : null}
            </View>
            <Badge tone="brand">Open</Badge>
          </View>
          {showAccess ? <AccessChips access={person.access} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowDivider: { height: 1, backgroundColor: colors.line, marginLeft: 68 },
  notice: { flexDirection: "row", gap: 14, paddingHorizontal: 14, paddingVertical: 14, alignItems: "flex-start" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.apricot },
  status: { borderRadius: radius.xl, backgroundColor: colors.brand950, padding: 20, gap: 14, overflow: "hidden", ...shadows.raised },
  statusGlow: { position: "absolute", top: -60, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(229,127,51,0.28)" },
  statePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 5 },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  upcoming: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center", marginTop: 1 },
  thread: { padding: 16, gap: 12, paddingBottom: 20 },
  chatHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { backgroundColor: colors.brand800, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6, ...shadows.xs },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  composerInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: colors.ink950,
    fontFamily: fonts.regular,
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand800, alignItems: "center", justifyContent: "center", ...shadows.button },
  person: { backgroundColor: "#fffdf9", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12, ...shadows.card },
});
