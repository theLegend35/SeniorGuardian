import { Platform, type ViewStyle } from "react-native";

export const colors = {
  canvas: "#f3efe6",
  canvasTop: "#f7f1e4",
  sand: "#e8e1d2",
  sandDeep: "#d9d0be",
  surface: "#fffcf7",
  line: "#e4dccf",
  lineStrong: "#cfc4b2",
  ink950: "#0a1a22",
  ink900: "#102a35",
  ink800: "#1c3946",
  ink700: "#33474f",
  ink600: "#4b5b62",
  ink500: "#5d6c72",
  // Darkened from #8a969b so small grey text reaches 4.5:1 on white and on the canvas color. The website matches.
  ink400: "#616e74",
  brand50: "#edf8f6",
  brand100: "#d3efea",
  brand200: "#a9ddd4",
  brand500: "#14796c",
  brand600: "#0d665b",
  brand700: "#0b564e",
  brand800: "#09443e",
  brand900: "#0a3f3b",
  brand950: "#062826",
  apricot: "#e57f33",
  apricot50: "#fff5ec",
  apricot100: "#ffe6d1",
  apricot400: "#f39a55",
  apricot700: "#a4501a",
  ai50: "#f5f3ff",
  ai200: "#d9d1fe",
  ai700: "#4a36b8",
  info50: "#eef4ff",
  info200: "#c7d7fe",
  info700: "#1d4ed8",
  success50: "#ecfaf1",
  success200: "#b5e8c8",
  success600: "#1a7f45",
  success700: "#166537",
  warning50: "#fff7e8",
  warning200: "#fbd9a0",
  warning600: "#b35c00",
  warning700: "#8f4a05",
  danger50: "#fff1f0",
  danger200: "#fdc9c4",
  danger600: "#c5281c",
  danger700: "#a01d14",
  white: "#ffffff",
};

/** Body text and headings use Manrope, so the zero is a plain circle. Homepage headlines use Instrument Serif. The website matches. */
export const fonts = {
  regular: "Manrope_400Regular",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  display: "Manrope_700Bold",
  displayHeavy: "Manrope_800ExtraBold",
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",
};

function shadow(web: string, opacity: number, radius: number, y: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: web } as ViewStyle,
    android: { elevation },
    default: { shadowColor: "#0b564e", shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: y } },
  });
}

export const shadows = {
  xs: shadow("0 1px 2px rgba(16,42,53,0.05)", 0.06, 2, 1, 1),
  card: shadow("0 1px 2px rgba(16,42,53,0.04), 0 10px 28px -16px rgba(11,86,78,0.22)", 0.1, 14, 6, 2),
  raised: shadow("0 2px 4px rgba(16,42,53,0.04), 0 22px 48px -18px rgba(11,86,78,0.28)", 0.16, 22, 10, 5),
  button: shadow("0 10px 22px -8px rgba(11,86,78,0.7)", 0.28, 12, 6, 3),
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 };
