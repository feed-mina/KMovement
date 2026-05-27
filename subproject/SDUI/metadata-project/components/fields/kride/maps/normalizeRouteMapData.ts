'use client';

import {
  DEFAULT_ROUTE_MAP_CENTER,
  DEFAULT_ROUTE_MAP_ZOOM,
  isRouteMapProvider,
  normalizePlaceName,
  RouteMapData,
  RouteMapMarker,
} from './mapTypes';

type PlaceMeta = {
  day?: number;
  slot?: string;
  description?: string;
  address?: string;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readName(value: any) {
  return value?.name ?? value?.placeName ?? value?.place_name ?? value?.title ?? value?.label ?? '';
}

function readDescription(value: any) {
  return value?.description ?? value?.desc ?? value?.content ?? value?.summary ?? value?.address ?? '';
}

function buildPlaceLookup(itinerary: any[]): Map<string, PlaceMeta> {
  const lookup = new Map<string, PlaceMeta>();
  itinerary.forEach((dayPlan, dayIndex) => {
    Object.entries(dayPlan ?? {}).forEach(([slot, slotValue]: [string, any]) => {
      const places = Array.isArray(slotValue?.places) ? slotValue.places : [];
      places.forEach((place: any) => {
        const key = normalizePlaceName(readName(place));
        if (!key || lookup.has(key)) return;
        lookup.set(key, {
          day: dayIndex + 1,
          slot,
          description: readDescription(place),
          address: place?.address,
        });
      });
    });
  });
  return lookup;
}

function averageCenter(markers: RouteMapMarker[]): [number, number] {
  if (markers.length === 0) return DEFAULT_ROUTE_MAP_CENTER;
  const total = markers.reduce(
    (acc, marker) => ({
      lat: acc.lat + marker.lat,
      lng: acc.lng + marker.lng,
    }),
    { lat: 0, lng: 0 },
  );
  return [total.lat / markers.length, total.lng / markers.length];
}

function normalizeMarker(rawMarker: any, index: number, placeLookup: Map<string, PlaceMeta>): RouteMapMarker | null {
  const lat = toNumber(rawMarker?.lat ?? rawMarker?.latitude ?? rawMarker?.y);
  const lng = toNumber(rawMarker?.lng ?? rawMarker?.lon ?? rawMarker?.longitude ?? rawMarker?.x);
  if (lat == null || lng == null) return null;

  const name = String(readName(rawMarker) || `Place ${index + 1}`);
  const placeMeta = placeLookup.get(normalizePlaceName(name));
  const markerIndex = toNumber(rawMarker?.index) ?? index;

  return {
    id: String(rawMarker?.id ?? rawMarker?.placeId ?? rawMarker?.place_id ?? `${normalizePlaceName(name)}-${index}`),
    index: markerIndex,
    day: toNumber(rawMarker?.day) ?? placeMeta?.day,
    slot: rawMarker?.slot ?? rawMarker?.timeSlot ?? rawMarker?.time_slot ?? placeMeta?.slot,
    name,
    description: rawMarker?.description ?? rawMarker?.desc ?? placeMeta?.description,
    address: rawMarker?.address ?? placeMeta?.address,
    lat,
    lng,
    imageUrl: rawMarker?.imageUrl ?? rawMarker?.image_url ?? rawMarker?.thumbnailUrl,
    externalUrls: rawMarker?.externalUrls ?? rawMarker?.external_urls,
  };
}

export function normalizeRouteMapData(rawData: any): RouteMapData {
  const source = rawData?.mapData ?? rawData ?? {};
  const rawMarkers = Array.isArray(source?.markers) ? source.markers : [];
  const itinerary = Array.isArray(rawData?.itinerary)
    ? rawData.itinerary
    : Array.isArray(source?.itinerary)
      ? source.itinerary
      : [];
  const placeLookup = buildPlaceLookup(itinerary);
  const markers = rawMarkers
    .map((marker: any, index: number) => normalizeMarker(marker, index, placeLookup))
    .filter((marker: RouteMapMarker | null): marker is RouteMapMarker => marker !== null);

  const rawCenter = source?.center;
  const centerLat = Array.isArray(rawCenter) ? toNumber(rawCenter[0]) : toNumber(source?.centerLat);
  const centerLng = Array.isArray(rawCenter) ? toNumber(rawCenter[1]) : toNumber(source?.centerLng);
  const center: [number, number] = centerLat != null && centerLng != null
    ? [centerLat, centerLng]
    : averageCenter(markers);
  const zoom = toNumber(source?.zoom) ?? DEFAULT_ROUTE_MAP_ZOOM;

  return {
    provider: isRouteMapProvider(source?.provider) ? source.provider : undefined,
    center,
    zoom,
    markers,
  };
}
