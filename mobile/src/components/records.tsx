import { router, type Href } from "expo-router";
import {
  Activity,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Droplets,
  FileText,
  Footprints,
  HeartPulse,
  MapPin,
  Moon,
  Phone,
  Pill,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { AppText, Badge, Button, Chip, DateTile, IconTile, ProgressBar, type Tone } from "@/components/ui";
import { MetricRing } from "@/components/MetricRing";
import { useAuth } from "@/lib/auth";
import { clock, formatTime, relativeDay, timeAgo } from "@/lib/format";
import { markTaken } from "@/lib/records";
import { subscribeReminders, syncReminders, type ReminderStatus } from "@/lib/reminders";
import { colors, radius, shadows } from "@/lib/theme";
import type { Dose, HealthProfile, Reading, TimelineItem, Visit } from "@/lib/types";

// ---------- Medicines ----------

export function DoseProgress({ doses }: { doses: Dose[] }) {
  const taken = doses.filter((dose) => dose.taken).length;
  const share = doses.length ? taken / doses.length : 0;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <AppText size={24} weight="heavy" color={colors.ink950}>
            {String(taken)}
          </AppText>
          <AppText size={15} weight="semibold" color={colors.ink600}>
            {`of ${doses.length} doses taken`}
          </AppText>
        </View>
        <AppText size={14.5} weight="bold" color={colors.brand700}>
          {`${Math.round(share * 100)}%`}
        </AppText>
      </View>
      <ProgressBar value={share} />
    </View>
  );
}

export function DoseRow({ dose, canMark, onDone, showLink = true }: { dose: Dose; canMark: boolean; onDone: () => void; showLink?: boolean }) {
  const { actor } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const due = !dose.taken && new Date(dose.scheduledFor).getTime() <= Date.now();

  const mark = async () => {
    if (!actor) return;
    setPending(true);
    setError(null);
    try {
      await markTaken(actor, dose.medicine, dose.time);
      await syncReminders(actor);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark this dose.");
    } finally {
      setPending(false);
    }
  };

  const open = showLink && actor?.role === "patient" ? () => router.push(`/patient/medicine/${dose.medicine.id}`) : undefined;

  return (
    <View style={[styles.dose, dose.taken ? styles.doseTaken : due ? styles.doseDue : styles.doseLater]}>
      <View style={styles.doseTop}>
        <View style={[styles.doseIcon, { backgroundColor: dose.taken ? colors.brand600 : due ? colors.apricot100 : colors.sand }]}>
          {dose.taken ? <Check size={20} color={colors.white} strokeWidth={3} /> : <Pill size={20} color={due ? colors.apricot700 : colors.ink600} />}
        </View>
        <Pressable disabled={!open} onPress={open} style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 }}>
            <AppText size={16.5} weight="bold" color={colors.ink950}>
              {dose.medicine.name}
            </AppText>
            <AppText size={14.5} weight="semibold" color={colors.ink500}>
              {formatTime(dose.time)}
            </AppText>
          </View>
          <AppText size={14} color={colors.ink500} lines={2}>
            {dose.medicine.instructions}
          </AppText>
        </Pressable>
      </View>
      <View style={styles.doseActions}>
        {dose.taken ? (
          <Badge tone="success" icon={Check}>
            Taken
          </Badge>
        ) : canMark ? (
          <Button
            label={pending ? "Saving…" : "Mark taken"}
            accessibilityLabel={`Mark taken: ${dose.medicine.name} at ${formatTime(dose.time)}`}
            icon={Check}
            size="sm"
            variant={due ? "primary" : "secondary"}
            loading={pending}
            inline
            onPress={() => void mark()}
          />
        ) : due ? (
          <Badge tone="apricot">Due</Badge>
        ) : (
          <Badge>Later</Badge>
        )}
        {!dose.taken ? (
          <AppText size={13} weight="semibold" color={due ? colors.apricot700 : colors.ink400}>
            {due ? "Due now" : "Later today"}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText size={14} color={colors.danger700}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function TimeChips({ times, off = false }: { times: string[]; off?: boolean }) {
  if (!times.length) {
    return (
      <AppText size={14} color={colors.ink500}>
        No reminder times yet.
      </AppText>
    );
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {times.map((time) => (
        <Chip key={time} icon={Clock} tone={off ? "neutral" : "brand"}>
          {formatTime(time)}
        </Chip>
      ))}
    </View>
  );
}

// ---------- Visits ----------

export function VisitRow({ visit, patientName, href, right }: { visit: Visit; patientName?: string; href?: Href; right?: React.ReactNode }) {
  const past = new Date(visit.startsAt).getTime() < Date.now();
  const body = (
    <>
      <DateTile iso={visit.startsAt} muted={past} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText size={16.5} weight="bold" color={colors.ink950}>
          {patientName ?? visit.provider}
        </AppText>
        <AppText size={14.5} weight="bold" color={past ? colors.ink500 : colors.brand700}>
          {visit.status === "completed" ? `Completed · ${clock(visit.startsAt)}` : `${relativeDay(visit.startsAt)} · ${clock(visit.startsAt)}`}
        </AppText>
        <AppText size={14} color={colors.ink600} lines={1}>
          {`${patientName ? `${visit.provider} · ` : ""}${visit.specialty || "Visit"}`}
        </AppText>
        {visit.location ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MapPin size={13} color={colors.ink400} />
            <AppText size={13.5} color={colors.ink500} lines={1} style={{ flex: 1 }}>
              {visit.location}
            </AppText>
          </View>
        ) : null}
      </View>
      {right}
      {href ? <ChevronRight size={20} color={colors.ink400} /> : null}
    </>
  );
  if (href) {
    return (
      <Pressable onPress={() => router.push(href)} style={({ pressed }) => [styles.visit, pressed && { backgroundColor: colors.canvas }]}>
        {body}
      </Pressable>
    );
  }
  return <View style={styles.visit}>{body}</View>;
}

// ---------- Timeline ----------

const KIND: Record<string, { icon: LucideIcon; tone: Tone; label: string }> = {
  concern: { icon: HeartPulse, tone: "apricot", label: "Health concern" },
  image: { icon: HeartPulse, tone: "apricot", label: "Photo" },
  medication_change: { icon: Pill, tone: "ai", label: "Medicine change" },
  medication_activity: { icon: Check, tone: "success", label: "Medicine taken" },
  appointment: { icon: CalendarDays, tone: "info", label: "Appointment" },
  doctor_note: { icon: Stethoscope, tone: "brand", label: "Doctor note" },
  patient_note: { icon: FileText, tone: "neutral", label: "Note" },
  document: { icon: FileText, tone: "neutral", label: "Document" },
};

export function TimelineList({ items, compact = false }: { items: TimelineItem[]; compact?: boolean }) {
  return (
    <View>
      {items.map((item, index) => {
        const meta = KIND[item.kind] ?? { icon: Activity, tone: "neutral" as Tone, label: "Activity" };
        return (
          <View key={item.id} style={styles.timelineRow}>
            <View style={{ alignItems: "center" }}>
              <IconTile icon={meta.icon} tone={meta.tone} size={38} />
              {index < items.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: 18 }}>
              <AppText size={16} weight="bold" color={colors.ink950}>
                {item.title}
              </AppText>
              {item.summary ? (
                <AppText size={14.5} color={colors.ink600} lines={compact ? 2 : undefined}>
                  {item.summary}
                </AppText>
              ) : null}
              <AppText size={13} color={colors.ink400}>
                {`${timeAgo(item.createdAt)}${item.source ? ` · ${item.source}` : ""}`}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------- Readings ----------

const METRIC_ICON: Record<string, LucideIcon> = {
  heart_rate: HeartPulse,
  sleep_hours: Moon,
  steps: Footprints,
  blood_oxygen: Droplets,
};

export function ReadingTile({ reading }: { reading: Reading }) {
  const outside = reading.status === "outside";
  const Icon = METRIC_ICON[reading.metric] ?? Activity;
  return (
    <View style={[styles.reading, outside && { borderColor: colors.warning200, backgroundColor: colors.warning50 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconTile icon={Icon} tone={outside ? "warning" : "brand"} size={36} />
        {outside ? <Badge tone="warning">Outside range</Badge> : null}
      </View>
      <View style={{ alignItems: "center" }}>
        <MetricRing
          metric={reading.metric}
          value={Number(reading.value)}
          unit={reading.unit}
          low={reading.low ? Number(reading.low) : null}
          high={reading.high ? Number(reading.high) : null}
          outside={outside}
        />
      </View>
      <AppText size={14} weight="semibold" color={colors.ink500}>
        {reading.label}
      </AppText>
      {reading.low && reading.high ? (
        <AppText size={12.5} color={colors.ink500}>
          {`Range ${reading.low}–${reading.high}`}
        </AppText>
      ) : null}
      <AppText size={12.5} color={colors.ink400}>
        {timeAgo(reading.recordedAt)}
      </AppText>
    </View>
  );
}

export function ReadingGrid({ readings }: { readings: Reading[] }) {
  return (
    <View style={styles.readingGrid}>
      {readings.map((reading) => (
        <View key={reading.metric} style={{ width: "50%", padding: 5 }}>
          <ReadingTile reading={reading} />
        </View>
      ))}
    </View>
  );
}

// ---------- Emergency information ----------

export function EmergencyCard({ health, onEdit }: { health: HealthProfile | null; onEdit?: () => void }) {
  const rows: Array<[string, string]> = [
    ["Allergies", health?.allergies || "None recorded"],
    ["Conditions", health?.conditions || "None recorded"],
    ["Blood type", health?.bloodType || "Not added"],
    ["Emergency contact", health?.emergencyContact || "Not added"],
  ];
  return (
    <View style={styles.emergency}>
      <View style={styles.emergencyGlow} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={16} color={colors.brand200} />
        <AppText size={12.5} weight="bold" color={colors.brand200} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
          Emergency information
        </AppText>
      </View>
      <View style={{ gap: 12 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={{ gap: 1 }}>
            <AppText size={13} weight="semibold" color="rgba(169,221,212,0.85)">
              {label}
            </AppText>
            <AppText size={16} weight="bold" color={colors.white}>
              {value}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.emergencyActions}>
        <Button label="Call 911" icon={Phone} variant="emergency" flex onPress={() => void Linking.openURL("tel:911")} />
        {onEdit ? <Button label="Edit" variant="light" onPress={onEdit} /> : null}
      </View>
    </View>
  );
}

// ---------- Phone reminders ----------

export function useReminderStatus(): ReminderStatus | null {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  useEffect(() => subscribeReminders(setStatus), []);
  return status;
}

/** The dark card that leads each home screen: what will ring next on this phone. */
export function ReminderHero({ href, caregiver = false }: { href: Href; caregiver?: boolean }) {
  const status = useReminderStatus();
  const next = status?.upcoming[0];
  const live = Boolean(status?.enabled && status.permission === "granted");
  const preview = status?.permission === "unavailable";
  const headline = next
    ? `${relativeDay(next.at)} at ${clock(next.at)}`
    : live
      ? "Nothing to ring yet"
      : status?.enabled === false
        ? "Paused on this phone"
        : "Turn on phone reminders";
  const body = next
    ? next.title
    : caregiver
      ? "Doses you manage and visits you can see ring here, even when the app is closed."
      : "Saved medicine and visit times ring here, even when the app is closed.";
  return (
    <Pressable onPress={() => router.push(href)} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.94 }]}>
      <View style={styles.heroGlow} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconTile icon={BellRing} tone="dark" size={46} />
        <View style={{ flex: 1, gap: 1 }}>
          <AppText size={12.5} weight="bold" color={colors.brand200} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
            {next ? "Next phone reminder" : "Phone reminders"}
          </AppText>
          <AppText size={19} weight="heavy" color={colors.white}>
            {headline}
          </AppText>
        </View>
        <ChevronRight size={22} color={colors.brand200} />
      </View>
      <AppText size={15} color="#d3efea" lines={2}>
        {body}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <View style={styles.heroPill}>
          <View style={[styles.heroDot, { backgroundColor: live ? "#5ee0a0" : preview ? colors.apricot400 : colors.ink400 }]} />
          <AppText size={13} weight="bold" color={colors.white}>
            {live ? `${status?.scheduled ?? 0} scheduled` : preview ? "Preview only, open on a phone" : status?.enabled === false ? "Paused" : "Needs permission"}
          </AppText>
        </View>
        <View style={styles.heroPill}>
          <AppText size={13} weight="bold" color={colors.white}>
            Rings when the app is closed
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dose: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  doseTaken: { borderColor: colors.line, backgroundColor: "rgba(243,239,230,0.7)" },
  doseDue: { borderColor: colors.apricot100, backgroundColor: "rgba(255,245,236,0.8)" },
  doseLater: { borderColor: colors.line, backgroundColor: colors.white },
  doseTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  doseIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  doseActions: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 52 },
  visit: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4, paddingVertical: 8, borderRadius: radius.md },
  timelineRow: { flexDirection: "row", gap: 14 },
  timelineLine: { position: "absolute", top: 40, bottom: 0, width: 1, backgroundColor: colors.lineStrong },
  reading: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14, gap: 4, ...shadows.xs },
  readingGrid: { flexDirection: "row", flexWrap: "wrap", margin: -5 },
  emergency: { borderRadius: radius.lg, backgroundColor: colors.brand950, padding: 20, gap: 16, overflow: "hidden", ...shadows.card },
  emergencyGlow: { position: "absolute", top: -50, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(229,127,51,0.22)" },
  emergencyActions: { flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 16 },
  hero: { borderRadius: radius.xl, backgroundColor: colors.brand950, padding: 18, gap: 12, overflow: "hidden", ...shadows.raised },
  heroGlow: { position: "absolute", top: -60, right: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(229,127,51,0.28)" },
  heroPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 5 },
  heroDot: { width: 8, height: 8, borderRadius: 4 },
});
