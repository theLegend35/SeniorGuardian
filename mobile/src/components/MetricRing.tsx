import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";

import { colors } from "@/lib/theme";

const RADIUS = 42;
const LENGTH = 2 * Math.PI * RADIUS;
const DISPLAY: Record<string, { low: number; high: number }> = {
  heart_rate: { low: 50, high: 100 },
  sleep_hours: { low: 6, high: 9 },
  steps: { low: 2000, high: 8000 },
  blood_oxygen: { low: 94, high: 100 },
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function gaugeFraction(value: number, low: number, high: number): number {
  if (!(high > low) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - low) / (high - low)));
}

export function MetricRing({
  metric,
  value,
  unit,
  low,
  high,
  outside,
}: {
  metric: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  outside: boolean;
}) {
  const fallback = DISPLAY[metric] ?? { low: 0, high: Math.max(value, 1) };
  const scale = low != null && high != null && high > low ? { low, high } : fallback;
  const fraction = gaugeFraction(value, scale.low, scale.high);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: fraction, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fraction, progress]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [LENGTH, 0] });
  const stroke = outside ? colors.apricot : colors.brand600;

  return (
    <Svg width={108} height={108} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r={RADIUS} fill="none" stroke={colors.sand} strokeWidth={10} />
      <G rotation={-90} origin="60, 60">
        <AnimatedCircle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${LENGTH} ${LENGTH}`}
          strokeDashoffset={offset}
        />
      </G>
      <SvgText x="60" y="58" textAnchor="middle" fill={colors.ink950} fontSize="20" fontWeight="700">
        {Number.isInteger(value) ? String(value) : value.toFixed(1)}
      </SvgText>
      <SvgText x="60" y="76" textAnchor="middle" fill={colors.ink500} fontSize="11">
        {unit}
      </SvgText>
    </Svg>
  );
}
