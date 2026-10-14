import { router, useFocusEffect, type Href } from "expo-router";
import { Bell, Check, ChevronRight, FileText, Info, Lock, ShieldCheck, Siren, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { useAuth } from "@/lib/auth";
import { readingScale, scaleMultiplier, subscribeReading } from "@/lib/reading";
import { listNotices } from "@/lib/records";
import { colors, fonts, radius, shadows } from "@/lib/theme";

// ---------- Data ----------

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const focused = useRef(false);

  useEffect(() => {
    let live = true;
    void load()
      .then((next) => {
        if (!live) return;
        setData(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      live = false;
    };
    // The caller passes the values that should reload this query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useFocusEffect(
    useCallback(() => {
      if (focused.current) setTick((value) => value + 1);
      focused.current = true;
    }, []),
  );

  return {
    data,
    error,
    loading,
    refreshing,
    reload: () => setTick((value) => value + 1),
    refresh: () => {
      setRefreshing(true);
      setTick((value) => value + 1);
    },
  };
}

// ---------- Text ----------

type Weight = "regular" | "semibold" | "bold" | "display" | "heavy" | "serif" | "serifItalic";

const FAMILY: Record<Weight, string> = {
  regular: fonts.regular,
  semibold: fonts.semibold,
  bold: fonts.bold,
  display: fonts.display,
  heavy: fonts.displayHeavy,
  serif: fonts.serif,
  serifItalic: fonts.serifItalic,
};

export function useScale(): number {
  const scale = useSyncExternalStore(subscribeReading, readingScale, readingScale);
  return scaleMultiplier(scale);
}

export function AppText({
  children,
  size = 16,
  weight = "regular",
  color = colors.ink800,
  align,
  lines,
  style,
}: {
  children: ReactNode;
  size?: number;
  weight?: Weight;
  color?: string;
  align?: TextStyle["textAlign"];
  lines?: number;
  style?: StyleProp<TextStyle>;
}) {
  const scale = useScale();
  const fontSize = Math.round(size * scale);
  const display = weight === "display" || weight === "heavy";
  const serif = weight === "serif" || weight === "serifItalic";
  return (
    <Text
      numberOfLines={lines}
      style={[
        {
          fontFamily: FAMILY[weight],
          fontSize,
          lineHeight: Math.round(fontSize * (serif ? 1.05 : display ? 1.2 : 1.42)),
          letterSpacing: serif ? -0.4 : display && size >= 24 ? -0.6 : display ? -0.2 : 0,
          color,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------- Layout ----------

export function Screen({
  children,
  top = false,
  footer,
  onRefresh,
  refreshing = false,
  scroll = true,
}: {
  children: ReactNode;
  top?: boolean;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={top ? ["top", "left", "right"] : ["left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} colors={[colors.brand700]} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
      {footer}
    </SafeAreaView>
  );
}

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width="40" height="40" rx="13" fill="#0b564e" />
      <Circle cx="15.5" cy="14.5" r="2.7" fill="#fff" />
      <Path d="M9.2 28.6c.7-4.8 3.1-7.4 6.3-7.4s5.6 2.6 6.3 7.4" fill="none" stroke="#fff" strokeWidth="2.15" strokeLinecap="round" />
      <Circle cx="26.2" cy="16.2" r="2.45" fill="#f39a55" />
      <Path d="M20.4 29.2c.7-4.2 2.8-6.5 5.8-6.5s5.1 2.3 5.8 6.5" fill="none" stroke="#f39a55" strokeWidth="2.15" strokeLinecap="round" />
    </Svg>
  );
}

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={styles.logo}>
      <LogoMark size={34} />
      <AppText size={17} weight="heavy" color={inverse ? colors.white : colors.ink950}>
        Senior Guardian
      </AppText>
    </View>
  );
}

/** The bar at the top of each tab: the logo, plus a bell that shows unread alerts. */
export function TopBar({ alertsHref }: { alertsHref: Href }) {
  const notices = useAsync(listNotices, []);
  const unread = (notices.data ?? []).filter((item) => !item.read).length;
  return (
    <View style={styles.topBar}>
      <Logo />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread ? `Alerts, ${unread} unread` : "Alerts"}
        onPress={() => router.push(alertsHref)}
        style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
      >
        <Bell size={22} color={colors.ink700} />
        {unread ? <View style={styles.bellDot} /> : null}
      </Pressable>
    </View>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={styles.pageHeader}>
      {eyebrow ? (
        <AppText size={15} weight="bold" color={colors.brand700}>
          {eyebrow}
        </AppText>
      ) : null}
      <AppText size={30} weight="heavy" color={colors.ink950}>
        {title}
      </AppText>
      {description ? (
        <AppText size={16.5} color={colors.ink600}>
          {description}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText size={20} weight="heavy" color={colors.ink950}>
        {children}
      </AppText>
      {action}
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.cardPad, style]}>{children}</View>;
}

export function CardHeader({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderMain}>
        {Icon ? (
          <View style={styles.cardHeaderIcon}>
            <Icon size={18} color={colors.brand700} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText size={17.5} weight="display" color={colors.ink950}>
            {title}
          </AppText>
          {description ? (
            <AppText size={14.5} color={colors.ink500}>
              {description}
            </AppText>
          ) : null}
        </View>
      </View>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ---------- Buttons ----------

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "dark" | "apricot" | "light" | "emergency";

const BUTTON: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand800, fg: colors.white, border: colors.brand800 },
  secondary: { bg: colors.white, fg: colors.ink900, border: colors.lineStrong },
  soft: { bg: colors.brand50, fg: colors.brand800, border: colors.brand50 },
  ghost: { bg: "transparent", fg: colors.ink700, border: "transparent" },
  danger: { bg: colors.white, fg: colors.danger700, border: colors.danger200 },
  dark: { bg: colors.ink950, fg: colors.white, border: colors.ink950 },
  apricot: { bg: colors.apricot, fg: colors.white, border: colors.apricot },
  light: { bg: "rgba(255,255,255,0.12)", fg: colors.white, border: "rgba(255,255,255,0.12)" },
  emergency: { bg: colors.danger600, fg: colors.white, border: colors.danger600 },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon: Icon,
  disabled = false,
  loading = false,
  inline = false,
  flex = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  inline?: boolean;
  flex?: boolean;
  accessibilityLabel?: string;
}) {
  const tone = BUTTON[variant];
  const height = size === "sm" ? 40 : size === "lg" ? 56 : 50;
  const text = size === "sm" ? 14.5 : size === "lg" ? 17 : 16;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          paddingHorizontal: size === "sm" ? 14 : 20,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: disabled ? 0.55 : 1,
        },
        variant === "primary" && shadows.button,
        variant === "secondary" && shadows.xs,
        inline && { alignSelf: "flex-start" },
        flex && { flex: 1 },
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={tone.fg} /> : Icon ? <Icon size={size === "sm" ? 16 : 18} color={tone.fg} /> : null}
      <AppText size={text} weight="bold" color={tone.fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconTile({ icon: Icon, tone = "brand", size = 44 }: { icon: LucideIcon; tone?: Tone | "dark"; size?: number }) {
  const palette = tone === "dark" ? { bg: "rgba(255,255,255,0.14)", fg: colors.white } : TILE[tone];
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: palette.bg }]}>
      <Icon size={size * 0.45} color={palette.fg} />
    </View>
  );
}

// ---------- Rows ----------

export function ListRow({
  icon,
  tone = "brand",
  title,
  body,
  right,
  onPress,
  href,
  leading,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  body?: string;
  right?: ReactNode;
  onPress?: () => void;
  href?: Href;
  leading?: ReactNode;
}) {
  const press = onPress ?? (href ? () => router.push(href) : undefined);
  return (
    <Pressable
      accessibilityRole={press ? "button" : undefined}
      disabled={!press}
      onPress={press}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.canvas }]}
    >
      {leading ?? (icon ? <IconTile icon={icon} tone={tone} size={42} /> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText size={16.5} weight="bold" color={colors.ink950}>
          {title}
        </AppText>
        {body ? (
          <AppText size={14.5} color={colors.ink500}>
            {body}
          </AppText>
        ) : null}
      </View>
      {right}
      {press ? <ChevronRight size={20} color={colors.ink400} /> : null}
    </Pressable>
  );
}

export function ListGroup({ children, title }: { children: ReactNode; title?: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <AppText size={13} weight="bold" color={colors.ink500} style={{ letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 4 }}>
          {title}
        </AppText>
      ) : null}
      <View style={[styles.card, { paddingVertical: 4 }]}>
        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.rowDivider} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- Status ----------

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "ai" | "apricot";

const BADGE: Record<Tone, { bg: string; fg: string; ring: string }> = {
  neutral: { bg: colors.sand, fg: colors.ink700, ring: colors.lineStrong },
  brand: { bg: colors.brand50, fg: colors.brand800, ring: colors.brand200 },
  success: { bg: colors.success50, fg: colors.success700, ring: colors.success200 },
  warning: { bg: colors.warning50, fg: colors.warning700, ring: colors.warning200 },
  danger: { bg: colors.danger50, fg: colors.danger700, ring: colors.danger200 },
  info: { bg: colors.info50, fg: colors.info700, ring: colors.info200 },
  ai: { bg: colors.ai50, fg: colors.ai700, ring: colors.ai200 },
  apricot: { bg: colors.apricot50, fg: colors.apricot700, ring: colors.apricot100 },
};

const TILE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.sand, fg: colors.ink600 },
  brand: { bg: colors.brand50, fg: colors.brand700 },
  success: { bg: colors.success50, fg: colors.success600 },
  warning: { bg: colors.warning50, fg: colors.warning600 },
  danger: { bg: colors.danger50, fg: colors.danger600 },
  info: { bg: colors.info50, fg: colors.info700 },
  ai: { bg: colors.ai50, fg: colors.ai700 },
  apricot: { bg: colors.apricot50, fg: colors.apricot700 },
};

export function Badge({ tone = "neutral", icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: string }) {
  const palette = BADGE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.ring }]}>
      {Icon ? <Icon size={13} color={palette.fg} strokeWidth={2.5} /> : null}
      <AppText size={12.5} weight="bold" color={palette.fg}>
        {children}
      </AppText>
    </View>
  );
}

const CALLOUT: Record<"info" | "warning" | "danger" | "success" | "brand", { bg: string; border: string; icon: LucideIcon; fg: string }> = {
  info: { bg: "#f3f7ff", border: colors.info200, icon: Info, fg: colors.info700 },
  warning: { bg: colors.warning50, border: colors.warning200, icon: TriangleAlert, fg: colors.warning600 },
  danger: { bg: colors.danger50, border: colors.danger200, icon: Siren, fg: colors.danger600 },
  success: { bg: colors.success50, border: colors.success200, icon: ShieldCheck, fg: colors.success600 },
  brand: { bg: colors.brand50, border: colors.brand200, icon: ShieldCheck, fg: colors.brand700 },
};

export function Callout({
  tone = "info",
  title,
  children,
  icon,
  action,
}: {
  tone?: keyof typeof CALLOUT;
  title?: string;
  children?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  const style = CALLOUT[tone];
  const Icon = icon ?? style.icon;
  return (
    <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={[styles.callout, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Icon size={20} color={style.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        {title ? (
          <AppText size={16} weight="bold" color={colors.ink950}>
            {title}
          </AppText>
        ) : null}
        {typeof children === "string" ? (
          <AppText size={15} color={colors.ink800}>
            {children}
          </AppText>
        ) : (
          children
        )}
        {action ? <View style={{ marginTop: 6 }}>{action}</View> : null}
      </View>
    </View>
  );
}

/** Original words or label text, shown as written. */
export function SourceBlock({ label = "Original", meta, children }: { label?: string; meta?: string; children: string }) {
  return (
    <View style={styles.source}>
      <View style={styles.sourceHead}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <FileText size={13} color={colors.ink700} />
          <AppText size={12} weight="bold" color={colors.ink700} style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
            {label}
          </AppText>
        </View>
        {meta ? (
          <AppText size={12.5} color={colors.ink500}>
            {meta}
          </AppText>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
        <AppText size={16} weight="semibold" color={colors.ink950}>
          {children}
        </AppText>
      </View>
    </View>
  );
}

export function EmptyState({ icon: Icon = FileText, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={24} color={colors.ink500} />
      </View>
      <AppText size={17} weight="bold" color={colors.ink900} align="center">
        {title}
      </AppText>
      {body ? (
        <AppText size={15} color={colors.ink500} align="center">
          {body}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
    </View>
  );
}

export function Locked({ title }: { title: string }) {
  return (
    <View style={styles.locked}>
      <IconTile icon={Lock} tone="neutral" size={40} />
      <View style={{ flex: 1 }}>
        <AppText size={16} weight="bold" color={colors.ink800}>
          {title}
        </AppText>
        <AppText size={14.5} color={colors.ink500}>
          Not shared with you. The patient chooses what you can see.
        </AppText>
      </View>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand700} />
      {label ? (
        <AppText size={14} color={colors.ink500}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorNote({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <Callout tone="danger" title={title}>
      {body}
    </Callout>
  );
}

export function Disclaimer() {
  return (
    <View style={styles.disclaimer}>
      <Info size={15} color={colors.ink400} style={{ marginTop: 2 }} />
      <AppText size={13.5} color={colors.ink500} style={{ flex: 1 }}>
        Senior Guardian is informational and does not replace your doctor, pharmacist, or emergency services. In an emergency, call 911.
      </AppText>
    </View>
  );
}

// ---------- People and dates ----------

const AVATAR = [
  [colors.brand100, colors.brand800],
  [colors.apricot100, colors.apricot700],
  ["#ece8ff", "#3c2d91"],
  ["#dbeafe", "#1e40af"],
  ["#fce7f3", "#9d174d"],
  ["#e0f2e9", "#14532d"],
];

export function initials(name: string): string {
  const parts = name.replace(/,.*$/, "").replace(/^(Dr\.?)\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR[hash % AVATAR.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <AppText size={size * 0.36} weight="heavy" color={fg}>
        {initials(name)}
      </AppText>
    </View>
  );
}

export function DateTile({ iso, muted = false }: { iso: string; muted?: boolean }) {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date);
  return (
    <View style={[styles.dateTile, { borderColor: muted ? colors.line : colors.brand200 }]}>
      <View style={{ backgroundColor: muted ? colors.sand : colors.brand700, alignSelf: "stretch", paddingVertical: 2 }}>
        <AppText size={11} weight="bold" color={muted ? colors.ink600 : colors.white} align="center" style={{ letterSpacing: 1, textTransform: "uppercase" }}>
          {month}
        </AppText>
      </View>
      <AppText size={22} weight="heavy" color={colors.ink950} align="center" style={{ paddingVertical: 3 }}>
        {day}
      </AppText>
    </View>
  );
}

export function Stat({ icon, label, value, tone = "brand" }: { icon: LucideIcon; label: string; value: string; tone?: Tone }) {
  return (
    <View style={[styles.card, styles.stat]}>
      <IconTile icon={icon} tone={tone} size={46} />
      <View style={{ flex: 1 }}>
        <AppText size={26} weight="heavy" color={colors.ink950}>
          {value}
        </AppText>
        <AppText size={14} weight="semibold" color={colors.ink500}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

export function KeyValue({ items }: { items: Array<[string, string]> }) {
  return (
    <View style={styles.keyValue}>
      {items.map(([label, value]) => (
        <View key={label} style={{ width: "50%", paddingRight: 10, gap: 2 }}>
          <AppText size={13} weight="semibold" color={colors.ink500}>
            {label}
          </AppText>
          <AppText size={15.5} weight={value ? "bold" : "regular"} color={value ? colors.ink950 : colors.ink400}>
            {value || "Not added"}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(value * 100), min: 0, max: 100 }}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

export function Chip({ icon: Icon, children, tone = "brand" }: { icon?: LucideIcon; children: string; tone?: "brand" | "neutral" }) {
  const on = tone === "brand";
  return (
    <View style={[styles.chip, { backgroundColor: on ? colors.brand50 : colors.sand }]}>
      {Icon ? <Icon size={14} color={on ? colors.brand700 : colors.ink600} /> : null}
      <AppText size={14} weight="bold" color={on ? colors.brand800 : colors.ink700}>
        {children}
      </AppText>
    </View>
  );
}

// ---------- Forms ----------

export function Field({
  label,
  hint,
  optional,
  rows,
  ...props
}: { label: string; hint?: string; optional?: boolean; rows?: number } & Omit<TextInputProps, "style">) {
  const [focus, setFocus] = useState(false);
  const scale = useScale();
  return (
    <View style={{ gap: 6 }}>
      <AppText size={15} weight="bold" color={colors.ink900}>
        {label}
        {optional ? <AppText size={14} color={colors.ink400}>{"  (optional)"}</AppText> : null}
      </AppText>
      <TextInput
        placeholderTextColor={colors.ink400}
        {...props}
        multiline={Boolean(rows) || props.multiline}
        onFocus={(event) => {
          setFocus(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocus(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          { fontSize: Math.round(17 * scale) },
          rows ? { minHeight: rows * 26 + 24, paddingTop: 12, textAlignVertical: "top" } : null,
          focus && styles.inputFocus,
        ]}
      />
      {hint ? (
        <AppText size={13.5} color={colors.ink500}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function SwitchRow({ label, description, value, onChange, disabled }: { label: string; description?: string; value: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText size={16} weight="bold" color={colors.ink900}>
          {label}
        </AppText>
        {description ? (
          <AppText size={14} color={colors.ink500}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.lineStrong, true: colors.brand600 }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.lineStrong}
      />
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (next: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            {on ? <Check size={15} color={colors.white} strokeWidth={3} /> : null}
            <AppText size={15} weight="bold" color={on ? colors.white : colors.ink700}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, gap: 18 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  logo: { flexDirection: "row", alignItems: "center", gap: 10 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 6, paddingBottom: 4 },
  bell: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  bellDot: { position: "absolute", top: 10, right: 11, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.apricot, borderWidth: 2, borderColor: colors.white },
  pageHeader: { gap: 6, paddingTop: 4 },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 },
  card: { backgroundColor: "#fffdf9", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, ...shadows.card },
  cardPad: { padding: 18, gap: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  cardHeaderMain: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  cardHeaderIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center", marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.line },
  button: { borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  tile: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, minHeight: 64 },
  rowDivider: { height: 1, backgroundColor: colors.line, marginLeft: 70 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  callout: { flexDirection: "row", gap: 12, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  source: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.white, overflow: "hidden" },
  sourceHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.canvas, borderBottomWidth: 1, borderBottomColor: colors.line },
  empty: { alignItems: "center", gap: 6, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong, backgroundColor: "rgba(255,255,255,0.6)", paddingHorizontal: 22, paddingVertical: 26 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  locked: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.6)", padding: 14 },
  loading: { paddingVertical: 28, alignItems: "center", gap: 8 },
  disclaimer: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  dateTile: { width: 56, borderRadius: 12, borderWidth: 1, backgroundColor: colors.white, overflow: "hidden", alignItems: "center" },
  stat: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, flex: 1 },
  keyValue: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  progress: { height: 10, borderRadius: 999, backgroundColor: colors.sand, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.brand500 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, alignSelf: "flex-start" },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    color: colors.ink950,
    fontFamily: fonts.regular,
    ...(shadows.xs as TextStyle),
  },
  inputFocus: { borderColor: colors.brand500, borderWidth: 2 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4 },
  segmented: { flexDirection: "row", gap: 6, padding: 5, borderRadius: 16, backgroundColor: colors.sand },
  segment: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segmentOn: { backgroundColor: colors.brand800, ...shadows.xs },
});
