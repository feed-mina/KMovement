'use client';

import { useMemo, useState } from "react";
import CollapseHeader from "./atoms/CollapseHeader";
import CollapseBody from "./atoms/CollapseBody";
import RouteNode from "./atoms/RouteNode";
import { normalizePlaceName, ROUTE_MARKER_SELECT_EVENT } from "./maps/mapTypes";

type AnyRecord = Record<string, any>;

interface TimeSlot {
  places: AnyRecord[];
}

interface DayPlan {
  day?: number;
  morning: TimeSlot;
  afternoon: TimeSlot;
}

const DURATION_TO_DAYS: Record<string, number> = {
  "당일치기": 1,
  "1박 2일": 2,
  "1박2일": 2,
  "2박 3일": 3,
  "2박3일": 3,
  day: 1,
  onenight: 2,
  twonight: 3,
};

function getDurationDays(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.floor(value));
  const text = String(value ?? "").trim();
  if (!text) return 1;
  if (DURATION_TO_DAYS[text]) return DURATION_TO_DAYS[text];
  if (text.includes("2박")) return 3;
  if (text.includes("1박")) return 2;
  return 1;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readName(value: AnyRecord) {
  return value?.name ?? value?.placeName ?? value?.place_name ?? value?.title ?? value?.label ?? "";
}

function readDescription(value: AnyRecord) {
  return value?.description ?? value?.desc ?? value?.summary ?? value?.address ?? "";
}

function readRawItinerary(data: AnyRecord): AnyRecord[] {
  const candidates = [
    data?.itinerary,
    data?.itinerary?.days,
    data?.itinerary?.itinerary,
    data?.mapData?.itinerary,
    data?.mapData?.itinerary?.days,
    data?.mapData?.itinerary?.itinerary,
  ];

  const found = candidates.find(Array.isArray);
  return Array.isArray(found) ? found : [];
}

function readCandidatePlaces(data: AnyRecord): AnyRecord[] {
  const candidates = [
    data?.mapData?.markers,
    data?.markers,
    data?.pois,
    data?.source_pois,
    data?.sourcePois,
  ];

  const seen = new Set<string>();
  const places: AnyRecord[] = [];

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;
    candidate.forEach((place, index) => {
      const name = readName(place);
      const key = normalizePlaceName(name || `${index}`);
      if (!key || seen.has(key)) return;
      seen.add(key);
      places.push(place);
    });
  });

  return places;
}

function readSlotPlaces(dayPlan: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const slot = dayPlan?.[key];
    if (Array.isArray(slot)) return slot;
    if (Array.isArray(slot?.places)) return slot.places;
    if (Array.isArray(slot?.items)) return slot.items;
    if (slot && typeof slot === "object" && readName(slot)) return [slot];
  }

  return [];
}

function normalizePlace(place: AnyRecord, fallbackIndex: number, markerLookup: Map<string, AnyRecord>) {
  const name = String(readName(place));
  if (!name) return null;

  const marker = markerLookup.get(normalizePlaceName(name));
  const lat = toNumber(place?.lat ?? place?.latitude ?? place?.y ?? marker?.lat ?? marker?.latitude ?? marker?.y);
  const lng = toNumber(
    place?.lng ?? place?.lon ?? place?.longitude ?? place?.x ?? marker?.lng ?? marker?.lon ?? marker?.longitude ?? marker?.x
  );

  return {
    ...marker,
    ...place,
    id: place?.id ?? place?.placeId ?? place?.place_id ?? marker?.id ?? marker?.placeId ?? marker?.place_id,
    index: toNumber(place?.index ?? marker?.index) ?? fallbackIndex,
    name,
    description: readDescription(place) || readDescription(marker ?? {}),
    address: place?.address ?? marker?.address,
    reason: place?.reason ?? place?.tip ?? marker?.reason ?? marker?.tip,
    lat,
    lng,
  };
}

function buildMarkerLookup(markerPlaces: AnyRecord[]) {
  const lookup = new Map<string, AnyRecord>();
  markerPlaces.forEach((marker) => {
    const key = normalizePlaceName(readName(marker));
    if (key && !lookup.has(key)) lookup.set(key, marker);
  });
  return lookup;
}

function splitPlaces(places: AnyRecord[], markerLookup: Map<string, AnyRecord>) {
  const middle = Math.ceil(places.length / 2);
  return {
    morning: {
      places: places
        .slice(0, middle)
        .map((place: AnyRecord, index: number) => normalizePlace(place, index, markerLookup))
        .filter(Boolean) as AnyRecord[],
    },
    afternoon: {
      places: places
        .slice(middle)
        .map((place: AnyRecord, index: number) => normalizePlace(place, middle + index, markerLookup))
        .filter(Boolean) as AnyRecord[],
    },
  };
}

function normalizeRawItinerary(rawDays: AnyRecord[], markerLookup: Map<string, AnyRecord>): DayPlan[] {
  return rawDays.map((dayPlan, dayIndex) => {
    const morning = readSlotPlaces(dayPlan, ["morning", "am", "오전"]);
    const afternoon = readSlotPlaces(dayPlan, ["afternoon", "pm", "오후"]);

    if (morning.length === 0 && afternoon.length === 0 && Array.isArray(dayPlan?.places)) {
      const split = splitPlaces(dayPlan.places, markerLookup);
      return { day: toNumber(dayPlan?.day) ?? dayIndex + 1, ...split };
    }

    return {
      day: toNumber(dayPlan?.day) ?? dayIndex + 1,
      morning: {
        places: morning
          .map((place: AnyRecord, index: number) => normalizePlace(place, index, markerLookup))
          .filter(Boolean) as AnyRecord[],
      },
      afternoon: {
        places: afternoon
          .map((place: AnyRecord, index: number) => normalizePlace(place, morning.length + index, markerLookup))
          .filter(Boolean) as AnyRecord[],
      },
    };
  });
}

function distributeMarkersIntoDays(markerPlaces: AnyRecord[], dayCount: number, markerLookup: Map<string, AnyRecord>) {
  const normalizedMarkers = markerPlaces
    .map((place, index) => normalizePlace(place, index, markerLookup))
    .filter(Boolean) as AnyRecord[];
  const perDay = Math.max(1, Math.ceil(normalizedMarkers.length / dayCount));

  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const dayPlaces = normalizedMarkers.slice(dayIndex * perDay, (dayIndex + 1) * perDay);
    const middle = Math.ceil(dayPlaces.length / 2);

    return {
      day: dayIndex + 1,
      morning: { places: dayPlaces.slice(0, middle) },
      afternoon: { places: dayPlaces.slice(middle) },
    };
  });
}

function countPlaces(days: DayPlan[]) {
  return days.reduce(
    (total, day) => total + day.morning.places.length + day.afternoon.places.length,
    0
  );
}

function getMaxDayFromPlaces(places: AnyRecord[]) {
  return places.reduce((max, place) => Math.max(max, toNumber(place?.day) ?? 0), 0);
}

function ensureDayCount(days: DayPlan[], dayCount: number): DayPlan[] {
  return Array.from({ length: dayCount }, (_, index) => (
    days[index] ?? { day: index + 1, morning: { places: [] }, afternoon: { places: [] } }
  ));
}

function buildItineraryViewData(data: AnyRecord) {
  const rawDays = readRawItinerary(data);
  const markerPlaces = readCandidatePlaces(data);
  const markerLookup = buildMarkerLookup(markerPlaces);
  const durationDays = getDurationDays(data?.duration ?? data?.itinerary?.duration ?? data?.mapData?.duration);
  const inferredDayCount = Math.max(durationDays, rawDays.length, getMaxDayFromPlaces(markerPlaces), 1);

  let itinerary = normalizeRawItinerary(rawDays, markerLookup);
  if (countPlaces(itinerary) === 0 && markerPlaces.length > 0) {
    itinerary = distributeMarkersIntoDays(markerPlaces, inferredDayCount, markerLookup);
  }

  const dayCount = Math.max(inferredDayCount, itinerary.length, 1);
  return {
    dayCount,
    itinerary: ensureDayCount(itinerary, dayCount),
  };
}

export default function ItineraryPanel({ id, data }: any) {
  const { itinerary, dayCount } = useMemo(() => buildItineraryViewData(data ?? {}), [data]);
  const [openSlots, setOpenSlots] = useState<Record<string, boolean>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const toggle = (key: string) =>
    setOpenSlots((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectPlace = (place: AnyRecord, day: number, slot: string, index: number) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(ROUTE_MARKER_SELECT_EVENT, {
      detail: {
        id: place?.id ?? place?.placeId ?? place?.place_id,
        name: place?.name ?? place?.placeName ?? place?.place_name,
        day,
        slot,
        index: place?.index ?? index,
      },
    }));
  };

  return (
    <div id={id} className="itinerary-panel flex flex-col w-full bg-gray-900 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.5)] transition-all duration-300">
      <div
        className="w-full flex justify-center py-4 cursor-pointer select-none"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
      </div>

      <div className={`flex flex-col gap-4 overflow-y-auto px-6 pb-6 transition-all duration-300 ${isPanelOpen ? 'max-h-[60vh] opacity-100' : 'max-h-0 opacity-0 px-6 pb-0 overflow-hidden'}`}>
        {Array.from({ length: dayCount }, (_, dayIdx) => {
          const plan = itinerary[dayIdx];
          const morningKey = `day${dayIdx}-morning`;
          const afternoonKey = `day${dayIdx}-afternoon`;

          return (
            <div key={dayIdx} className="border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-gray-800 pl-6 pr-4 py-2">
                <h3 className="text-white font-bold text-sm">
                  {dayCount === 1 ? "당일" : `Day ${dayIdx + 1}`}
                </h3>
              </div>

              <CollapseHeader id={morningKey} meta={{}} data={{}} label="오전" isOpen={openSlots[morningKey]} onToggle={() => toggle(morningKey)} />
              <CollapseBody id={morningKey} meta={{}} data={{}} isOpen={openSlots[morningKey]}>
                {plan.morning.places.length === 0 ? (
                  <p className="text-gray-500 text-xs py-2">일정이 없습니다</p>
                ) : (
                  plan.morning.places.map((place, index) => (
                    <RouteNode
                      key={place?.id ?? `${morningKey}-${index}`}
                      id={`${morningKey}-${index}`}
                      meta={{}}
                      data={place}
                      index={index}
                      onSelect={() => selectPlace(place, dayIdx + 1, "morning", index)}
                    />
                  ))
                )}
              </CollapseBody>

              <CollapseHeader id={afternoonKey} meta={{}} data={{}} label="오후" isOpen={openSlots[afternoonKey]} onToggle={() => toggle(afternoonKey)} />
              <CollapseBody id={afternoonKey} meta={{}} data={{}} isOpen={openSlots[afternoonKey]}>
                {plan.afternoon.places.length === 0 ? (
                  <p className="text-gray-500 text-xs py-2">일정이 없습니다</p>
                ) : (
                  plan.afternoon.places.map((place, index) => (
                    <RouteNode
                      key={place?.id ?? `${afternoonKey}-${index}`}
                      id={`${afternoonKey}-${index}`}
                      meta={{}}
                      data={place}
                      index={plan.morning.places.length + index}
                      onSelect={() => selectPlace(place, dayIdx + 1, "afternoon", plan.morning.places.length + index)}
                    />
                  ))
                )}
              </CollapseBody>
            </div>
          );
        })}
      </div>
    </div>
  );
}
