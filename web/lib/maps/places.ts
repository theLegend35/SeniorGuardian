export type PlaceCategory = "urgent_care" | "pharmacy" | "hospital" | "primary_care" | "clinic";

export const CATEGORIES: Record<PlaceCategory, { label: string; query: string; includedType?: string }> = {
  urgent_care: { label: "Urgent care", query: "urgent care" },
  pharmacy: { label: "Pharmacies", query: "pharmacy", includedType: "pharmacy" },
  hospital: { label: "Hospitals & ER", query: "hospital emergency room", includedType: "hospital" },
  primary_care: { label: "Primary care", query: "primary care doctor" },
  clinic: { label: "Walk-in clinics", query: "walk-in clinic" },
};

export function isCategory(value: string): value is PlaceCategory {
  return value in CATEGORIES;
}

export type LatLng = { lat: number; lng: number };

export type CarePlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  kind: string;
  address: string;
  phone: string | null;
  location: LatLng;
  distanceMiles: number | null;
  openNow: boolean | null;
  hours: string[];
  rating: number | null;
  ratingCount: number | null;
  mapsUrl: string;
  website: string | null;
  googlePlaceId: string | null;
};

export type FinderResult = {
  places: CarePlace[];
  origin: LatLng | null;
  originLabel: string | null;
  source: "google" | "osm";
  notice: string | null;
};

export function milesBetween(a: LatLng, b: LatLng): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function directionsUrl(place: Pick<CarePlace, "location" | "googlePlaceId" | "address">): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", place.googlePlaceId ? place.address : `${place.location.lat},${place.location.lng}`);
  if (place.googlePlaceId) url.searchParams.set("destination_place_id", place.googlePlaceId);
  return url.toString();
}

function serverKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.currentOpeningHours.openNow",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
].join(",");

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
};

async function searchText(key: string, body: Record<string, unknown>, fieldMask: string): Promise<GooglePlace[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify({ languageCode: "en", ...body }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Places search failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const payload = (await response.json()) as { places?: GooglePlace[] };
  return payload.places ?? [];
}

function todayHours(descriptions: string[] | undefined): string[] {
  if (!descriptions?.length) return [];
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  const today = descriptions.find((line) => line.startsWith(weekday));
  return today ? [today.replace(`${weekday}: `, "")] : [];
}

function unavailable(source: "osm" | "google"): FinderResult {
  return {
    places: [],
    origin: null,
    originLabel: null,
    source,
    notice: "Nearby search is unavailable right now. Try again in a moment. If this is an emergency, call 911.",
  };
}

const OSM_UA = "SeniorHelpAI/1.0 (care finder)";
const SEARCH_MILES = 25;

const PHOTON_QUERY: Record<PlaceCategory, { q: string; tag?: string }> = {
  hospital: { q: "hospital", tag: "amenity:hospital" },
  pharmacy: { q: "pharmacy", tag: "amenity:pharmacy" },
  primary_care: { q: "doctor", tag: "amenity:doctors" },
  clinic: { q: "clinic", tag: "amenity:clinic" },
  urgent_care: { q: "urgent care" },
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
};

function photonAddress(properties: NonNullable<PhotonFeature["properties"]>): string {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const city = [properties.city, properties.state].filter(Boolean).join(", ");
  return [street, city, properties.postcode].filter(Boolean).join(", ") || "Address not listed";
}

function searchBox(origin: LatLng): string {
  const latPad = SEARCH_MILES / 69;
  const lngPad = SEARCH_MILES / (69 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
  return [origin.lng - lngPad, origin.lat - latPad, origin.lng + lngPad, origin.lat + latPad].join(",");
}

async function geocodeOsm(near: string): Promise<{ origin: LatLng; label: string } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", near);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: { "User-Agent": OSM_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Location lookup failed (${response.status})`);
  const matches = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const match = matches[0];
  if (!match?.lat || !match.lon) return null;
  return { origin: { lat: Number(match.lat), lng: Number(match.lon) }, label: match.display_name ?? near };
}

async function searchOsm(category: PlaceCategory, origin: LatLng): Promise<CarePlace[]> {
  const spec = PHOTON_QUERY[category];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", spec.q);
  if (spec.tag) url.searchParams.set("osm_tag", spec.tag);
  url.searchParams.set("lat", String(origin.lat));
  url.searchParams.set("lon", String(origin.lng));
  url.searchParams.set("bbox", searchBox(origin));
  url.searchParams.set("limit", "15");
  url.searchParams.set("lang", "en");
  const response = await fetch(url, {
    headers: { "User-Agent": OSM_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nearby search failed (${response.status})`);
  const payload = (await response.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const places: CarePlace[] = [];
  for (const feature of payload.features ?? []) {
    const properties = feature.properties;
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    const name = properties?.name?.trim();
    if (!properties || !name || lat === undefined || lng === undefined) continue;
    if (properties.osm_value === "veterinary") continue;
    if (category === "urgent_care" && !/urgent|express care/i.test(name)) continue;
    const location = { lat, lng };
    const distanceMiles = Math.round(milesBetween(origin, location) * 10) / 10;
    if (distanceMiles > SEARCH_MILES) continue;
    const key = `${properties.osm_type ?? "x"}-${properties.osm_id ?? name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const address = photonAddress(properties);
    places.push({
      id: `osm-${properties.osm_type ?? "place"}-${properties.osm_id ?? places.length}`,
      name,
      category,
      kind: { hospital: "Hospital", pharmacy: "Pharmacy", primary_care: "Primary care", clinic: "Clinic", urgent_care: "Urgent care" }[category],
      address,
      phone: null,
      location,
      distanceMiles,
      openNow: null,
      hours: [],
      rating: null,
      ratingCount: null,
      mapsUrl: directionsUrl({ location, googlePlaceId: null, address }),
      website: null,
      googlePlaceId: null,
    });
  }
  return places.sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0)).slice(0, 12);
}

async function findCareOsm(input: { category: PlaceCategory; origin: LatLng | null; near: string | null }): Promise<FinderResult> {
  let origin = input.origin;
  let originLabel = origin ? "Your current location" : null;
  if (!origin && input.near) {
    const found = await geocodeOsm(input.near);
    if (!found) {
      return { places: [], origin: null, originLabel: null, source: "osm", notice: `We couldn't find “${input.near}”. Try a city and state, or a ZIP code.` };
    }
    origin = found.origin;
    originLabel = found.label;
  }
  if (!origin) return { places: [], origin: null, originLabel: null, source: "osm", notice: null };
  const places = await searchOsm(input.category, origin);
  return {
    places,
    origin,
    originLabel,
    source: "osm",
    notice: places.length ? null : "No places were found within about 25 miles. Try another category or a nearby city.",
  };
}

export async function findCare(input: { category: PlaceCategory; origin: LatLng | null; near: string | null }): Promise<FinderResult> {
  const key = serverKey();
  if (!key) {
    try {
      return await findCareOsm(input);
    } catch (error) {
      console.error("[maps]", error instanceof Error ? error.message : error);
      return unavailable("osm");
    }
  }
  const config = CATEGORIES[input.category];
  try {
    let origin = input.origin;
    let originLabel: string | null = origin ? "Your current location" : null;
    if (!origin && input.near) {
      const [match] = await searchText(key, { textQuery: input.near, pageSize: 1 }, "places.location,places.formattedAddress");
      if (!match?.location) {
        return { places: [], origin: null, originLabel: null, source: "google", notice: `We couldn't find “${input.near}”. Try a city and state, or a ZIP code.` };
      }
      origin = { lat: match.location.latitude, lng: match.location.longitude };
      originLabel = match.formattedAddress ?? input.near;
    }
    if (!origin) {
      return { places: [], origin: null, originLabel: null, source: "google", notice: "Share your location or type a city or ZIP code to search." };
    }
    const found = await searchText(
      key,
      {
        textQuery: config.query,
        pageSize: 12,
        rankPreference: "DISTANCE",
        locationBias: { circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius: 25_000 } },
        ...(config.includedType ? { includedType: config.includedType, strictTypeFiltering: true } : {}),
      },
      FIELDS,
    );
    const places: CarePlace[] = found
      .filter((place) => place.location)
      .map((place) => {
        const location = { lat: place.location!.latitude, lng: place.location!.longitude };
        const base = {
          location,
          googlePlaceId: place.id,
          address: place.formattedAddress ?? place.shortFormattedAddress ?? "",
        };
        return {
          id: place.id,
          name: place.displayName?.text ?? "Unnamed place",
          category: input.category,
          kind: place.primaryTypeDisplayName?.text ?? config.label,
          address: base.address,
          phone: place.nationalPhoneNumber ?? null,
          location,
          distanceMiles: Math.round(milesBetween(origin, location) * 10) / 10,
          openNow: place.currentOpeningHours?.openNow ?? null,
          hours: todayHours(place.regularOpeningHours?.weekdayDescriptions),
          rating: place.rating ?? null,
          ratingCount: place.userRatingCount ?? null,
          mapsUrl: directionsUrl(base),
          website: place.websiteUri ?? null,
          googlePlaceId: place.id,
        };
      })
      .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0));
    return {
      places,
      origin,
      originLabel,
      source: "google",
      notice: places.length ? null : "No places were found nearby. Try another category or a larger town nearby.",
    };
  } catch (error) {
    console.error("[maps]", error instanceof Error ? error.message : error);
    return unavailable("google");
  }
}
