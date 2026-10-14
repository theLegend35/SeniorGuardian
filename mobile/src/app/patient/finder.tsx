import * as Location from "expo-location";
import { Building2, Clock, Cross, Globe, MapPin, Navigation, Phone, Pill, Search, Star, Stethoscope, Store, type LucideIcon } from "lucide-react-native";
import { createElement, useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { AppText, Badge, Button, Callout, Card, EmptyState, Loading, PageHeader, Screen } from "@/components/ui";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import { findPlaces, type CarePlace, type FinderResult } from "@/lib/web-api";

const CATEGORIES: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "urgent_care", label: "Urgent care", icon: Cross },
  { id: "pharmacy", label: "Pharmacies", icon: Pill },
  { id: "hospital", label: "Hospitals & ER", icon: Building2 },
  { id: "primary_care", label: "Primary care", icon: Stethoscope },
  { id: "clinic", label: "Walk-in clinics", icon: Store },
];

type Query = { category: string; origin: { lat: number; lng: number } | null; near: string | null };

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function mapSearch(result: FinderResult, label: string) {
  if (result.origin) return `https://www.google.com/maps/search/${encodeURIComponent(label)}/@${result.origin.lat},${result.origin.lng},13z`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
}

function osmSrc(result: FinderResult, selected: CarePlace | null) {
  const points = [...result.places.map((place) => place.location), ...(result.origin ? [result.origin] : [])];
  if (!points.length) return null;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const pad = 0.01;
  const bbox = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad].join(",");
  const marker = selected?.location ?? result.places[0]?.location ?? result.origin;
  if (!marker) return null;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${marker.lat},${marker.lng}`;
}

function PlaceCard({ place, index, selected, onSelect }: { place: CarePlace; index: number; selected: boolean; onSelect: () => void }) {
  return (
    <View style={[styles.place, selected && styles.placeOn]}>
      <Pressable accessibilityRole="button" onPress={onSelect} style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={[styles.index, { backgroundColor: selected ? colors.apricot : colors.brand700 }]}>
          <AppText size={15} weight="heavy" color={colors.white}>
            {index + 1}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText size={17} weight="bold" color={colors.ink950}>
            {place.name}
          </AppText>
          <AppText size={14} color={colors.ink600}>
            {place.kind}
            {place.distanceMiles != null ? ` · ${place.distanceMiles} mi` : ""}
            {place.rating != null ? ` · ${place.rating.toFixed(1)}` : ""}
            {place.ratingCount ? ` (${place.ratingCount})` : ""}
          </AppText>
        </View>
        {place.openNow === true ? <Badge tone="success">Open now</Badge> : place.openNow === false ? <Badge>Closed</Badge> : null}
      </View>
      <View style={{ gap: 4, paddingLeft: 46 }}>
        <View style={styles.meta}>
          <MapPin size={15} color={colors.ink400} />
          <AppText size={14.5} color={colors.ink700} style={{ flex: 1 }}>
            {place.address}
          </AppText>
        </View>
        {place.hours[0] ? (
          <View style={styles.meta}>
            <Clock size={15} color={colors.ink400} />
            <AppText size={14.5} color={colors.ink700} style={{ flex: 1 }}>
              {`Today: ${place.hours[0]}`}
            </AppText>
          </View>
        ) : null}
        {place.rating != null ? (
          <View style={styles.meta}>
            <Star size={15} color={colors.apricot400} fill={colors.apricot400} />
            <AppText size={14} color={colors.ink600}>
              {place.rating.toFixed(1)}
              {place.ratingCount ? ` from ${place.ratingCount} ratings` : ""}
            </AppText>
          </View>
        ) : null}
      </View>
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 46 }}>
        <Button label="Directions" icon={Navigation} size="sm" inline onPress={() => void Linking.openURL(place.mapsUrl)} />
        {place.phone ? <Button label={place.phone} icon={Phone} size="sm" variant="secondary" inline onPress={() => void Linking.openURL(telHref(place.phone!))} /> : null}
        {place.website ? <Button label="Website" icon={Globe} size="sm" variant="ghost" inline onPress={() => void Linking.openURL(place.website!)} /> : null}
      </View>
    </View>
  );
}

export default function FinderScreen() {
  const [query, setQuery] = useState<Query>({ category: "urgent_care", origin: null, near: null });
  const [nearText, setNearText] = useState("");
  const [result, setResult] = useState<FinderResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const run = useCallback(async (next: Query) => {
    setQuery(next);
    setLoading(true);
    setError(null);
    setSelectedId(null);
    try {
      setResult(
        await findPlaces({
          category: next.category,
          lat: next.origin?.lat,
          lng: next.origin?.lng,
          near: next.origin ? undefined : next.near ?? undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run({ category: "urgent_care", origin: null, near: null });
  }, [run]);

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Location isn't available. Type a city or ZIP code instead.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNearText("");
      await run({ ...query, origin: { lat: position.coords.latitude, lng: position.coords.longitude }, near: null });
    } catch {
      setError("We couldn't get your location. Check the location permission, or type a city or ZIP code.");
    } finally {
      setLocating(false);
    }
  }

  const selected = result?.places.find((place) => place.id === selectedId) ?? null;
  const category = CATEGORIES.find((item) => item.id === query.category) ?? CATEGORIES[0]!;
  const frame = result ? osmSrc(result, selected) : null;

  return (
    <Screen>
      <PageHeader eyebrow="Nearby" title="Find care" description="Urgent care, pharmacies, hospitals, and clinics — with distance, today's hours, and directions." />
      <Callout
        tone="danger"
        title="Having an emergency?"
        action={<Button label="Call 911" icon={Phone} variant="emergency" size="sm" inline onPress={() => void Linking.openURL("tel:911")} />}
      >
        Chest pain, trouble breathing, stroke signs, or severe bleeding — don't drive yourself. Call 911.
      </Callout>

      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((item) => {
            const on = item.id === query.category;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => void run({ ...query, category: item.id })}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Icon size={16} color={on ? colors.white : colors.ink700} />
                <AppText size={14.5} weight="bold" color={on ? colors.white : colors.ink800}>
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button label={locating ? "Finding you…" : "Use my location"} icon={MapPin} variant="soft" loading={locating} onPress={() => void locate()} />
        <View style={styles.searchRow}>
          <TextInput
            value={nearText}
            onChangeText={setNearText}
            placeholder="Or type a city or ZIP code"
            placeholderTextColor={colors.ink400}
            autoCapitalize="words"
            onSubmitEditing={() => {
              if (nearText.trim()) void run({ ...query, origin: null, near: nearText.trim() });
            }}
            style={styles.search}
            accessibilityLabel="City or ZIP code"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={() => {
              if (nearText.trim()) void run({ ...query, origin: null, near: nearText.trim() });
            }}
            style={styles.searchButton}
          >
            <Search size={18} color={colors.white} />
          </Pressable>
        </View>
        {result?.originLabel ? (
          <AppText size={14.5} color={colors.ink500}>
            Near <AppText size={14.5} weight="bold" color={colors.ink800}>{result.originLabel}</AppText>
          </AppText>
        ) : null}
      </Card>

      {error ? (
        <Callout tone="warning" title="Search needs another try">
          {error}
        </Callout>
      ) : null}
      {result?.notice ? (
        <Callout tone="warning" title="Nothing to show yet">
          {result.notice}
        </Callout>
      ) : null}

      {frame && Platform.OS === "web" ? (
        <View style={styles.map}>
          {createElement("iframe", { title: "Map of nearby care", src: frame, style: { width: "100%", height: "100%", border: 0 } })}
        </View>
      ) : null}
      {result?.places.length ? (
        <Button label="Open the map" icon={Navigation} variant="secondary" onPress={() => void Linking.openURL(selected?.mapsUrl || mapSearch(result, category.label))} />
      ) : null}

      {loading ? <Loading label="Looking nearby" /> : null}
      {!loading && result && result.places.length === 0 ? <EmptyState icon={MapPin} title="No places yet" body="Use your location or type a city to see care nearby." /> : null}
      {result?.places.map((place, index) => (
        <PlaceCard key={place.id} place={place} index={index} selected={place.id === selectedId} onSelect={() => setSelectedId(place.id === selectedId ? null : place.id)} />
      ))}
      {result?.source === "google" ? (
        <AppText size={12.5} color={colors.ink400} style={{ textAlign: "right" }}>
          Places data © Google
        </AppText>
      ) : result?.source === "osm" ? (
        <AppText size={12.5} color={colors.ink400} style={{ textAlign: "right" }}>
          Places © OpenStreetMap contributors
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, minHeight: 42 },
  chipOn: { backgroundColor: colors.ink950, borderColor: colors.ink950 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  search: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    color: colors.ink950,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  searchButton: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand800 },
  map: { height: 240, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.sand },
  place: { gap: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14, ...shadows.card },
  placeOn: { borderColor: colors.apricot400, borderWidth: 2 },
  index: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
});
