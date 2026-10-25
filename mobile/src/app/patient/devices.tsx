import { Activity, Watch } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";

import { ReadingGrid } from "@/components/records";
import { AppText, Badge, Button, Callout, Card, CardHeader, Divider, EmptyState, ErrorNote, Field, IconTile, Loading, PageHeader, Screen, Segmented, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { localDate, timeAgo } from "@/lib/format";
import { listReadings, saveReadingRange } from "@/lib/records";
import { colors } from "@/lib/theme";
import { startDeviceSignIn, syncDevice } from "@/lib/web-api";

const WORN_WINDOW_MS = 3 * 60 * 60 * 1000;

function devicePresence(lastReadingAt: string | null) {
  if (!lastReadingAt) return { on: false, label: "Offline", detail: "No number has arrived from this device." };
  const age = Date.now() - new Date(lastReadingAt).getTime();
  const when = timeAgo(lastReadingAt).toLowerCase();
  if (age >= -60_000 && age <= WORN_WINDOW_MS) {
    return { on: true, label: "On", detail: `The latest number arrived ${when}.` };
  }
  return { on: false, label: "Offline", detail: `The last number arrived ${when}. Nothing newer has come in.` };
}

const EMPTY_RANGES: Array<{ metric: string; low: string; high: string }> = [];

const RANGE_METRICS = [
  { value: "heart_rate", label: "Heart" },
  { value: "sleep_hours", label: "Sleep" },
  { value: "steps", label: "Steps" },
  { value: "blood_oxygen", label: "Oxygen" },
] as const;

const PROVIDERS = [
  {
    id: "google_health" as const,
    account: "Google Health",
    signIn: "Sign in with Google",
    devices: "Fitbit trackers and Pixel Watch, once they sync to the Google Health account.",
    reads: "Resting heart rate, steps, sleep, and blood oxygen.",
  },
  {
    id: "oura" as const,
    account: "Oura",
    signIn: "Sign in with Oura",
    devices: "Oura Ring generation 3 and later.",
    reads: "Sleep, steps, heart rate, and blood oxygen.",
  },
  {
    id: "withings" as const,
    account: "Withings",
    signIn: "Sign in with Withings",
    devices: "ScanWatch, Body scales, BPM monitors, and Sleep Analyzer.",
    reads: "Heart rate, steps, blood oxygen, and sleep.",
  },
];

async function openProvider(id: (typeof PROVIDERS)[number]["id"]) {
  const url = await startDeviceSignIn(id);
  try {
    const WebBrowser = await import("expo-web-browser");
    await WebBrowser.openAuthSessionAsync(url, "seniorguardian://patient/devices", { toolbarColor: "#062826", showTitle: true, createTask: false });
  } catch {
    await Linking.openURL(url);
  }
  await syncDevice(id).catch(() => undefined);
}

function RangeEditor({
  patientId,
  ranges,
  onSaved,
}: {
  patientId: string;
  ranges: Array<{ metric: string; low: string; high: string }>;
  onSaved: () => void;
}) {
  const [metric, setMetric] = useState<(typeof RANGE_METRICS)[number]["value"]>("heart_rate");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = ranges.find((range) => range.metric === metric);
    setLow(saved?.low ?? "");
    setHigh(saved?.high ?? "");
  }, [metric, ranges]);

  function choose(next: (typeof RANGE_METRICS)[number]["value"]) {
    const saved = ranges.find((range) => range.metric === next);
    setMetric(next);
    setLow(saved?.low ?? "");
    setHigh(saved?.high ?? "");
    setNotice(null);
    setError(null);
  }

  return (
    <Card>
      <CardHeader icon={Activity} title="When a number should notify you" description="A reading is flagged only when it falls outside a range saved here." />
      <Segmented options={[...RANGE_METRICS]} value={metric} onChange={choose} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Low" value={low} onChangeText={setLow} keyboardType="decimal-pad" placeholder="50" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="High" value={high} onChangeText={setHigh} keyboardType="decimal-pad" placeholder="100" />
        </View>
      </View>
      {error ? <ErrorNote title="Could not save the range" body={error} /> : null}
      {notice ? (
        <Callout tone="success" title="Range saved">
          {notice}
        </Callout>
      ) : null}
      <Button
        label="Save range"
        loading={saving}
        onPress={() => {
          setSaving(true);
          setNotice(null);
          setError(null);
          void saveReadingRange(patientId, metric, low, high)
            .then(() => {
              setNotice("New readings use this range. It is the same range as the website.");
              onSaved();
            })
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The range could not be saved."))
            .finally(() => setSaving(false));
        }}
      />
    </Card>
  );
}

export default function Devices() {
  const { actor } = useAuth();
  const [opening, setOpening] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const { data, error, loading, refreshing, refresh } = useAsync(() => listReadings(actor?.patientId ?? ""), [actor?.patientId]);
  const readings = data?.readings ?? [];
  const connections = data?.connections ?? [];
  const known = new Set<string>(PROVIDERS.map((provider) => provider.id));
  const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));
  const other = connections.filter((connection) => !known.has(connection.provider));
  // Only readings from today raise the warning; older numbers stay in the list below.
  const todayOutside = readings.filter((reading) => reading.status === "outside" && localDate(new Date(reading.recordedAt)) === localDate());
  const flagged = todayOutside[0];
  const outside = todayOutside.length;
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <PageHeader
        eyebrow="Rings and watches"
        title="Device readings"
        description="A device already on this account stays connected. Sign in only for a company that is not connected yet."
      />
      {PROVIDERS.map((provider) => {
        const connection = byProvider.get(provider.id);
        const presence = connection ? devicePresence(connection.lastReadingAt) : null;
        return (
          <Card key={provider.id}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText size={12.5} weight="bold" color={colors.brand700}>
                  {presence ? presence.label.toUpperCase() : "SIGN IN"}
                </AppText>
                <AppText size={22} weight="heavy" color={colors.ink950}>
                  {connection?.label || provider.account}
                </AppText>
              </View>
              {presence ? <Badge tone={presence.on ? "success" : "apricot"}>{presence.label}</Badge> : null}
            </View>
            <AppText size={15} color={colors.ink600}>
              {presence ? `${provider.devices} ${presence.detail}` : `${provider.devices} Reads ${provider.reads.charAt(0).toLowerCase()}${provider.reads.slice(1)}`}
            </AppText>
            {connection ? null : (
              <Button
                label={opening === provider.id ? "Opening…" : provider.signIn}
                loading={opening === provider.id}
                onPress={() => {
                  setSignInError(null);
                  setOpening(provider.id);
                  const sub = AppState.addEventListener("change", (state) => {
                    if (state === "active") refresh();
                  });
                  void openProvider(provider.id)
                    .catch((reason: unknown) => setSignInError(reason instanceof Error ? reason.message : "That sign-in could not open."))
                    .finally(() => {
                      setOpening(null);
                      setTimeout(() => sub.remove(), 60_000);
                    });
                }}
              />
            )}
          </Card>
        );
      })}
      <ErrorNote title="Could not load devices" body={error} />
      <ErrorNote title="Sign-in did not open" body={signInError} />
      {loading ? <Loading /> : null}
      {outside ? (
        <Callout
          tone="warning"
          title={
            flagged?.low && flagged.high
              ? `${flagged.label} is outside ${flagged.low}–${flagged.high} ${flagged.unit}`
              : `${outside} reading${outside === 1 ? " is" : "s are"} outside the saved range`
          }
        >
          This is a signal to look, not a diagnosis. If you feel unwell, contact a clinician. In an emergency, call 911.
        </Callout>
      ) : null}
      {!loading ? (
        <Card>
          <CardHeader icon={Activity} title="Latest readings" />
          {readings.length ? <ReadingGrid readings={readings} /> : <EmptyState icon={Activity} title="No readings yet" body="After Google Health, Oura, or Withings connects, the latest numbers show up here." />}
        </Card>
      ) : null}
      {actor?.patientId ? <RangeEditor patientId={actor.patientId} ranges={data?.ranges ?? EMPTY_RANGES} onSaved={refresh} /> : null}
      {other.length ? (
        <Card>
          <CardHeader icon={Watch} title="Already on this record" />
          {other.map((connection, index) => (
            <View key={connection.id} style={{ gap: 12 }}>
              {index > 0 ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <IconTile icon={Watch} tone="neutral" size={40} />
                <AppText size={16} weight="bold" color={colors.ink950} style={{ flex: 1 }}>
                  {connection.label}
                </AppText>
                <Badge tone={devicePresence(connection.lastReadingAt).on ? "success" : "apricot"}>
                  {devicePresence(connection.lastReadingAt).label}
                </Badge>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
