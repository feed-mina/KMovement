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

function readItinerary(rawData: any, source: any): any[] {
  const candidates = [
    rawData?.itinerary,
    rawData?.itinerary?.days,
    rawData?.itinerary?.itinerary,
    source?.itinerary,
    source?.itinerary?.days,
    source?.itinerary?.itinerary,
  ];
  const found = candidates.find(Array.isArray);
  return Array.isArray(found) ? found : [];
}

function readSlotPlaces(dayPlan: any, slot: string): any[] {
  const value = dayPlan?.[slot];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.places)) return value.places;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function flattenItineraryPlaces(itinerary: any[]): any[] {
  const places: any[] = [];
  itinerary.forEach((dayPlan, dayIndex) => {
    const day = toNumber(dayPlan?.day) ?? dayIndex + 1;
    ['morning', 'afternoon', 'evening'].forEach((slot) => {
      readSlotPlaces(dayPlan, slot).forEach((place, index) => {
        places.push({ ...place, day: place?.day ?? day, slot: place?.slot ?? slot, index: place?.index ?? index });
      });
    });
    if (Array.isArray(dayPlan?.places)) {
      dayPlan.places.forEach((place: any, index: number) => {
        places.push({ ...place, day: place?.day ?? day, slot: place?.slot ?? 'day', index: place?.index ?? index });
      });
    }
  });
  return places;
}

function buildPlaceLookup(places: any[]): Map<string, PlaceMeta> {
  const lookup = new Map<string, PlaceMeta>();
  places.forEach((place) => {
    const key = normalizePlaceName(readName(place));
    if (!key || lookup.has(key)) return;
    lookup.set(key, {
      day: toNumber(place?.day) ?? undefined,
      slot: place?.slot,
      description: readDescription(place),
      address: place?.address,
    });
  });
  return lookup;
}

function averageCenter(markers: RouteMapMarker[]): [number, number] {
  if (markers.length === 0) return DEFAULT_ROUTE_MAP_CENTER;
  const total = markers.reduce(
    (acc, marker) => ({ lat: acc.lat + marker.lat, lng: acc.lng + marker.lng }),
    { lat: 0, lng: 0 },
  );
  return [total.lat / markers.length, total.lng / markers.length];
}

function normalizeMarker(rawMarker: any, index: number, placeLookup: Map<string, PlaceMeta>): RouteMapMarker | null {
  const lat = toNumber(rawMarker?.lat ?? rawMarker?.latitude ?? rawMarker?.mapy ?? rawMarker?.y);
  const lng = toNumber(rawMarker?.lng ?? rawMarker?.lon ?? rawMarker?.longitude ?? rawMarker?.mapx ?? rawMarker?.x);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const name = String(readName(rawMarker) || `Place ${index + 1}`);
  const placeMeta = placeLookup.get(normalizePlaceName(name));
  const markerIndex = toNumber(rawMarker?.index) ?? index;

  return {
    id: String(rawMarker?.id ?? rawMarker?.poi_id ?? rawMarker?.placeId ?? rawMarker?.place_id ?? `${normalizePlaceName(name)}-${markerIndex}`),
    index: markerIndex,
    day: toNumber(rawMarker?.day) ?? placeMeta?.day,
    slot: rawMarker?.slot ?? rawMarker?.timeSlot ?? rawMarker?.time_slot ?? placeMeta?.slot,
    name,
    description: rawMarker?.description ?? rawMarker?.desc ?? placeMeta?.description,
    address: rawMarker?.address ?? placeMeta?.address,
    lat,
    lng,
    coordinateSource: rawMarker?.coordinateSource ?? rawMarker?.coordinate_source,
    imageUrl: rawMarker?.imageUrl ?? rawMarker?.image_url ?? rawMarker?.thumbnailUrl,
    externalUrls: rawMarker?.externalUrls ?? rawMarker?.external_urls,
  };
}

function dedupeMarkers(markers: RouteMapMarker[]) {
  const seen = new Set<string>();
  return markers.filter((marker) => {
    const key = `${normalizePlaceName(marker.name)}|${marker.lat.toFixed(6)}|${marker.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function preferNonEmptyMarkers(incoming: unknown, existing: unknown): any[] {
  if (Array.isArray(incoming) && incoming.length > 0) return incoming;
  return Array.isArray(existing) ? existing : [];
}

export function normalizeRouteMapData(rawData: any): RouteMapData {
  const source = rawData?.mapData ?? rawData ?? {};
  const itinerary = readItinerary(rawData, source);
  const itineraryPlaces = flattenItineraryPlaces(itinerary);
  const placeLookup = buildPlaceLookup(itineraryPlaces);
  const candidateGroups = [
    source?.markers,
    rawData?.markers,
    rawData?.pois,
    rawData?.source_pois,
    rawData?.sourcePois,
    itineraryPlaces,
  ];
  const rawMarkers = candidateGroups.flatMap((candidate) => Array.isArray(candidate) ? candidate : []);
  const markers = dedupeMarkers(rawMarkers
    .map((marker: any, index: number) => normalizeMarker(marker, index, placeLookup))
    .filter((marker: RouteMapMarker | null): marker is RouteMapMarker => marker !== null));

  const markerNames = new Set(markers.map((marker) => normalizePlaceName(marker.name)));
  const unresolvedFromResponse = rawData?.unresolvedPlaces ?? source?.unresolvedPlaces;
  const inferredUnresolved = itineraryPlaces.filter((place) => !markerNames.has(normalizePlaceName(readName(place)))).length;
  const unresolvedPlaceCount = Array.isArray(unresolvedFromResponse) ? unresolvedFromResponse.length : inferredUnresolved;
  const hasItinerary = itinerary.length > 0;
  const explicitStatus = rawData?.markerResolutionStatus ?? source?.markerResolutionStatus;
  const markerResolutionStatus = explicitStatus ?? (
    !hasItinerary ? 'not_required' : markers.length === 0 ? 'failed' : unresolvedPlaceCount > 0 ? 'partial' : 'complete'
  );

  const rawCenter = source?.center;
  const centerLat = Array.isArray(rawCenter) ? toNumber(rawCenter[0]) : toNumber(source?.centerLat);
  const centerLng = Array.isArray(rawCenter) ? toNumber(rawCenter[1]) : toNumber(source?.centerLng);
  const center: [number, number] = centerLat != null && centerLng != null
    ? [centerLat, centerLng]
    : averageCenter(markers);

  return {
    provider: isRouteMapProvider(source?.provider) ? source.provider : undefined,
    center,
    zoom: toNumber(source?.zoom) ?? DEFAULT_ROUTE_MAP_ZOOM,
    markers,
    hasItinerary,
    markerResolutionStatus,
    unresolvedPlaceCount,
  };
}
