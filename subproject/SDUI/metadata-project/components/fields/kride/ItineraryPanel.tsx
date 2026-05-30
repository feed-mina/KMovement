'use client';
import { useState } from "react";
import CollapseHeader from "./atoms/CollapseHeader";
import CollapseBody from "./atoms/CollapseBody";
import RouteNode from "./atoms/RouteNode";
import { ROUTE_MARKER_SELECT_EVENT } from "./maps/mapTypes";

interface TimeSlot {
  places: { name: string; description?: string }[];
}

interface DayPlan {
  morning: TimeSlot;
  afternoon: TimeSlot;
}

const DURATION_TO_DAYS: Record<string, number> = {
  "당일치기": 1,
  "1박2일": 2,
  "2박3일": 3,
  day: 1,
  onenight: 2,
  twonight: 3,
};

export default function ItineraryPanel({ id, data }: any) {
  const duration: string = data?.duration ?? "당일치기";
  const itinerary: DayPlan[] = data?.itinerary ?? [];
  const dayCount = DURATION_TO_DAYS[duration] ?? 1;

  const [openSlots, setOpenSlots] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setOpenSlots((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectPlace = (place: any, day: number, slot: string, index: number) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(ROUTE_MARKER_SELECT_EVENT, {
      detail: {
        id: place?.id ?? place?.placeId ?? place?.place_id,
        name: place?.name ?? place?.placeName ?? place?.place_name,
        day,
        slot,
        index,
      },
    }));
  };

  return (
    <div id={id} className="itinerary-panel flex flex-col gap-4 overflow-y-auto h-full">
      {Array.from({ length: dayCount }, (_, dayIdx) => {
        const plan: DayPlan = itinerary[dayIdx] ?? {
          morning: { places: [] },
          afternoon: { places: [] },
        };
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
                plan.morning.places.map((place, i) => (
                  <RouteNode
                    key={i}
                    id={`${morningKey}-${i}`}
                    meta={{}}
                    data={place}
                    index={i}
                    onSelect={() => selectPlace(place, dayIdx + 1, "morning", i)}
                  />
                ))
              )}
            </CollapseBody>

            <CollapseHeader id={afternoonKey} meta={{}} data={{}} label="오후" isOpen={openSlots[afternoonKey]} onToggle={() => toggle(afternoonKey)} />
            <CollapseBody id={afternoonKey} meta={{}} data={{}} isOpen={openSlots[afternoonKey]}>
              {plan.afternoon.places.length === 0 ? (
                <p className="text-gray-500 text-xs py-2">일정이 없습니다</p>
              ) : (
                plan.afternoon.places.map((place, i) => (
                  <RouteNode
                    key={i}
                    id={`${afternoonKey}-${i}`}
                    meta={{}}
                    data={place}
                    index={i}
                    onSelect={() => selectPlace(place, dayIdx + 1, "afternoon", i)}
                  />
                ))
              )}
            </CollapseBody>
          </div>
        );
      })}
    </div>
  );
}
