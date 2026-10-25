/// <reference types="google.maps" />
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, AdvancedMarker, InfoWindow, Map, useMap } from "@vis.gl/react-google-maps";
import { Building2, Clock, Cross, Globe, LoaderCircle, LocateFixed, MapPin, Navigation, Phone, Pill, Search, Star, Stethoscope, Store, type LucideIcon } from "lucide-react";

import { Badge, Callout, buttonClass, cx } from "@/components/ui/primitives";
import { CATEGORIES, type CarePlace, type FinderResult, type LatLng, type PlaceCategory } from "@/lib/maps/places";

const ICONS: Record<PlaceCategory, LucideIcon> = {
  urgent_care: Cross,
  pharmacy: Pill,
  hospital: Building2,
  primary_care: Stethoscope,
  clinic: Store,
};

type Query = { category: PlaceCategory; origin: LatLng | null; near: string | null };

function FitBounds({ places, origin, selected }: { places: CarePlace[]; origin: LatLng | null; selected: CarePlace | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !places.length) return;
    const bounds = new google.maps.LatLngBounds();
    places.forEach((place) => bounds.extend(place.location));
    if (origin) bounds.extend(origin);
    map.fitBounds(bounds, 48);
  }, [map, places, origin]);
  useEffect(() => {
    if (map && selected) map.panTo(selected.location);
  }, [map, selected]);
  return null;
}

function GoogleMapView({ apiKey, mapId, result, selected, onSelect }: { apiKey: string; mapId: string; result: FinderResult; selected: CarePlace | null; onSelect: (id: string | null) => void }) {
  const center = result.origin ?? result.places[0]?.location ?? { lat: 39.5, lng: -98.35 };
  return (
    <APIProvider apiKey={apiKey}>
      <Map mapId={mapId} defaultCenter={center} defaultZoom={12} gestureHandling="cooperative" disableDefaultUI={false} streetViewControl={false} mapTypeControl={false} className="size-full">
        <FitBounds places={result.places} origin={result.origin} selected={selected} />
        {result.origin ? (
          <AdvancedMarker position={result.origin} title="Search center">
            <span className="block size-5 rounded-full border-[3px] border-white bg-[#1d4ed8] shadow-lg" />
          </AdvancedMarker>
        ) : null}
        {result.places.map((place, index) => (
          <AdvancedMarker key={place.id} position={place.location} title={place.name} onClick={() => onSelect(place.id)} zIndex={selected?.id === place.id ? 10 : 1}>
            <span
              className={cx(
                "grid size-9 place-items-center rounded-full border-[3px] border-white font-display text-[0.9rem] font-extrabold shadow-lg transition-transform",
                selected?.id === place.id ? "scale-125 bg-apricot-500 text-ink-950" : "bg-brand-700 text-white",
              )}
            >
              {index + 1}
            </span>
          </AdvancedMarker>
        ))}
        {selected ? (
          <InfoWindow position={selected.location} pixelOffset={[0, -40]} onCloseClick={() => onSelect(null)} headerContent={<strong>{selected.name}</strong>}>
            <p style={{ margin: 0 }}>{selected.address}</p>
          </InfoWindow>
        ) : null}
      </Map>
    </APIProvider>
  );
}

function OsmMapView({ result, selected }: { result: FinderResult; selected: CarePlace | null }) {
  const points = [...result.places.map((place) => place.location), ...(result.origin ? [result.origin] : [])];
  if (!points.length) return <div className="grid size-full place-items-center bg-sand text-ink-500">No map to show yet</div>;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const pad = 0.01;
  const bbox = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad].join(",");
  const marker = selected?.location ?? result.places[0]?.location ?? result.origin!;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${marker.lat},${marker.lng}`;
  return <iframe key={src} title="Map of nearby care" src={src} className="size-full border-0" loading="lazy" />;
}

function PlaceCard({ place, index, selected, onSelect }: { place: CarePlace; index: number; selected: boolean; onSelect: () => void }) {
  return (
    <li data-place={place.id}>
      <article
        className={cx("card cursor-pointer p-4 transition-all", selected ? "ring-2 ring-apricot-400 shadow-raised" : "hover:shadow-raised")}
        onClick={onSelect}
        aria-current={selected || undefined}
      >
        <div className="flex gap-3">
          <span className={cx("grid size-9 flex-none place-items-center rounded-full font-display text-[0.92rem] font-extrabold", selected ? "bg-apricot-500 text-ink-950" : "bg-brand-700 text-white")}>{index + 1}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[1.08rem] leading-snug font-bold text-ink-950">{place.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9rem] text-ink-600">
              <span>{place.kind}</span>
              {place.distanceMiles !== null ? <span className="font-semibold text-ink-800">· {place.distanceMiles} mi</span> : null}
              {place.rating ? (
                <span className="inline-flex items-center gap-0.5">
                  · <Star className="size-3.5 fill-apricot-400 text-apricot-400" aria-hidden /> {place.rating.toFixed(1)}
                  {place.ratingCount ? <span className="text-ink-400">({place.ratingCount})</span> : null}
                </span>
              ) : null}
            </p>
          </div>
          {place.openNow === true ? <Badge tone="success">Open now</Badge> : place.openNow === false ? <Badge tone="neutral">Closed</Badge> : null}
        </div>
        <div className="mt-3 grid gap-1 pl-12 text-[0.92rem] text-ink-600">
          <p className="flex gap-1.5">
            <MapPin className="mt-0.5 size-4 flex-none text-ink-400" aria-hidden /> {place.address}
          </p>
          {place.hours[0] ? (
            <p className="flex gap-1.5">
              <Clock className="mt-0.5 size-4 flex-none text-ink-400" aria-hidden /> Today: {place.hours[0]}
            </p>
          ) : null}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2 pl-12" onClick={(event) => event.stopPropagation()}>
          <a href={place.mapsUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
            <Navigation className="size-4" aria-hidden /> Directions
          </a>
          {place.phone ? (
            <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className={buttonClass("secondary", "sm")}>
              <Phone className="size-4" aria-hidden /> {place.phone}
            </a>
          ) : null}
          {place.website ? (
            <a href={place.website} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")}>
              <Globe className="size-4" aria-hidden /> Website
            </a>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export function CareFinder({ initialCategory, mapsKey, mapId }: { initialCategory: PlaceCategory; mapsKey: string | null; mapId: string }) {
  const [query, setQuery] = useState<Query>({ category: initialCategory, origin: null, near: null });
  const [result, setResult] = useState<FinderResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nearText, setNearText] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const run = useCallback(async (next: Query) => {
    setQuery(next);
    setLoading(true);
    setError(null);
    setSelectedId(null);
    const params = new URLSearchParams({ category: next.category });
    if (next.origin) {
      params.set("lat", String(next.origin.lat));
      params.set("lng", String(next.origin.lng));
    } else if (next.near) params.set("near", next.near);
    try {
      const response = await fetch(`/api/places?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Search failed.");
      setResult((await response.json()) as FinderResult);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run({ category: initialCategory, origin: null, near: null });
  }, [run, initialCategory]);

  function locate() {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser. Type a city or ZIP code instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setNearText("");
        void run({ ...query, origin: { lat: position.coords.latitude, lng: position.coords.longitude }, near: null });
      },
      () => {
        setLocating(false);
        setError("We couldn't get your location. Check your browser's location permission, or type a city or ZIP code.");
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  }

  const selected = useMemo(() => result?.places.find((place) => place.id === selectedId) ?? null, [result, selectedId]);

  function select(id: string | null) {
    setSelectedId(id);
    if (id) listRef.current?.querySelector(`[data-place="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div className="grid gap-5">
      <div className="card grid gap-4 p-4 sm:p-5">
        <div role="tablist" aria-label="Type of care" className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
          {(Object.keys(CATEGORIES) as PlaceCategory[]).map((key) => {
            const Icon = ICONS[key];
            const active = query.category === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => void run({ ...query, category: key })}
                className={cx(
                  "inline-flex min-h-11 flex-none items-center gap-2 rounded-xl px-4 font-semibold transition-colors",
                  active ? "bg-ink-950 text-white" : "border border-line bg-white text-ink-700 hover:border-line-strong",
                )}
              >
                <Icon className="size-4" aria-hidden /> {CATEGORIES[key].label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={locate} disabled={locating} className={buttonClass("soft", "md")}>
            {locating ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
            {locating ? "Finding you…" : "Use my location"}
          </button>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (nearText.trim()) void run({ ...query, origin: null, near: nearText.trim() });
            }}
          >
            <label htmlFor="near" className="sr-only">
              City or ZIP code
            </label>
            <input id="near" value={nearText} onChange={(event) => setNearText(event.target.value)} className="input" placeholder="Or type a city or ZIP code" />
            <button type="submit" className={buttonClass("primary", "md")} aria-label="Search">
              <Search className="size-4" aria-hidden /> <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>
        {result?.originLabel ? (
          <p className="text-[0.9rem] text-ink-500">
            Near <span className="font-semibold text-ink-800">{result.originLabel}</span>
          </p>
        ) : null}
      </div>

      {error ? <Callout tone="warning">{error}</Callout> : null}
      {result?.notice ? <Callout tone="warning">{result.notice}</Callout> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="order-2 lg:order-1">
          {loading ? (
            <ul className="grid gap-3" aria-busy>
              {[0, 1, 2].map((item) => (
                <li key={item} className="card h-36 animate-pulse bg-sand/60" />
              ))}
            </ul>
          ) : result?.places.length ? (
            <ul ref={listRef} className="grid gap-3">
              {result.places.map((place, index) => (
                <PlaceCard key={place.id} place={place} index={index} selected={place.id === selectedId} onSelect={() => select(place.id)} />
              ))}
            </ul>
          ) : (
            <div className="card grid place-items-center gap-2 px-6 py-12 text-center text-ink-500">
              <MapPin className="size-8" aria-hidden />
              <p>Use your location or type a city to see places nearby.</p>
            </div>
          )}
        </div>
        <div className="order-1 lg:order-2">
          <div className="card h-72 overflow-hidden sm:h-96 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)] lg:max-h-[44rem]">
            {result ? (
              mapsKey ? (
                <GoogleMapView apiKey={mapsKey} mapId={mapId} result={result} selected={selected} onSelect={select} />
              ) : (
                <OsmMapView result={result} selected={selected} />
              )
            ) : (
              <div className="size-full animate-pulse bg-sand" />
            )}
          </div>
          {result?.source === "google" ? <p className="mt-2 text-right text-[0.78rem] text-ink-400">Places data © Google</p> : null}
          {result?.source === "osm" ? <p className="mt-2 text-right text-[0.78rem] text-ink-400">Places © OpenStreetMap contributors, via Photon</p> : null}
        </div>
      </div>
    </div>
  );
}
