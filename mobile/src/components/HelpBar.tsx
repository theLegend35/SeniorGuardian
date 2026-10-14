import { Accessibility, MessageCircleHeart } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AppText } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { applyReadingScale, readingScale } from "@/lib/reading";
import { updateProfile } from "@/lib/records";
import { webUrl } from "@/lib/supabase";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { TextScale } from "@/lib/types";

const SIZES: Array<{ id: TextScale; label: string }> = [
  { id: "default", label: "Default" },
  { id: "large", label: "Large" },
  { id: "largest", label: "Extra large" },
];

export function HelpBar({
  onAsk,
  bottom = 0,
}: {
  onAsk?: () => void;
  bottom?: number;
}) {
  const { actor, refresh } = useAuth();
  const [panel, setPanel] = useState(false);
  const [scale, setScale] = useState<TextScale>(readingScale());

  async function choose(next: TextScale) {
    setScale(next);
    applyReadingScale(next);
    if (!actor) return;
    try {
      await updateProfile(actor.profileId, { textScale: next });
      await refresh();
    } catch {
      setScale(actor.textScale);
      applyReadingScale(actor.textScale);
    }
  }

  return (
    <View style={[styles.bar, { bottom }]} pointerEvents="box-none">
      {panel ? (
        <View style={styles.panel} accessibilityRole="summary">
          <AppText size={16} weight="heavy" color={colors.ink950}>
            Accessibility options
          </AppText>
          <AppText size={13.5} color={colors.ink600}>
            Larger text is easier to read. After you sign in, the choice is saved with your account.
          </AppText>
          <View style={styles.sizes} accessibilityRole="radiogroup">
            {SIZES.map((item) => {
              const on = scale === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${item.label} text`}
                  onPress={() => void choose(item.id)}
                  style={[styles.size, on && styles.sizeOn]}
                >
                  <Text numberOfLines={1} style={[styles.sizeLabel, on && styles.sizeLabelOn]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {webUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Full accessibility statement"
              onPress={() => void Linking.openURL(`${webUrl}/accessibility`)}
            >
              <AppText size={14} weight="bold" color={colors.brand700}>
                Full accessibility statement
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.row} pointerEvents="box-none">
        <View style={styles.ring}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accessibility options"
            accessibilityState={{ expanded: panel }}
            onPress={() => {
              setScale(readingScale());
              setPanel((open) => !open);
            }}
            style={styles.icon}
          >
            <Accessibility size={22} color={colors.white} />
          </Pressable>
        </View>
        {onAsk ? (
          <View style={styles.ring}>
            <Pressable accessibilityRole="button" accessibilityLabel="Chat" onPress={onAsk} style={styles.icon}>
              <MessageCircleHeart size={22} color={colors.white} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", right: 16, alignItems: "flex-end", gap: 8, backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "transparent" },
  ring: { padding: 1.5, borderRadius: 17.5, backgroundColor: "rgba(6, 40, 38, 0.6)", ...shadows.button },
  icon: { width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: colors.white, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand950 },
  panel: { width: 300, gap: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14, ...shadows.raised },
  sizes: { flexDirection: "row", gap: 6 },
  size: { flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  sizeOn: { backgroundColor: colors.brand800 },
  sizeLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink800 },
  sizeLabelOn: { color: colors.white },
});
