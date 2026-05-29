'use client';
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useUiScreen } from "@/engine/hooks/useUiScreen";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useOnboardingStore, type TravelDuration } from "@/store/onboarding-store";
import ItineraryPanel from "@/components/kride/ItineraryPanel";

const MapView = dynamic(() => import("@/components/kride/MapView"), { ssr: false });

interface TimeSlot {
  places: { name: string; description?: string }[];
}
interface DayPlan {
  morning: TimeSlot;
  afternoon: TimeSlot;
}

// const MOCK_ITINERARY: Record<TravelDuration, DayPlan[]> = {
//   day: [
//     {
//       morning: { places: [{ name: "경복궁", description: "조선 정궁" }, { name: "인사동", description: "전통문화거리" }] },
//       afternoon: { places: [{ name: "명동", description: "쇼핑 & 먹거리" }, { name: "남산서울타워", description: "서울 야경 명소" }] },
//     },
//   ],
//   onenight: [
//     {
//       morning: { places: [{ name: "경복궁" }, { name: "창덕궁" }] },
//       afternoon: { places: [{ name: "인사동" }, { name: "북촌한옥마을" }] },
//     },
//     {
//       morning: { places: [{ name: "남산서울타워" }, { name: "명동" }] },
//       afternoon: { places: [{ name: "홍대" }, { name: "강남 COEX" }] },
//     },
//   ],
//   twonight: [
//     {
//       morning: { places: [{ name: "경복궁" }, { name: "창덕궁" }] },
//       afternoon: { places: [{ name: "인사동" }, { name: "북촌한옥마을" }] },
//     },
//     {
//       morning: { places: [{ name: "남산서울타워" }, { name: "명동" }] },
//       afternoon: { places: [{ name: "홍대" }, { name: "이태원" }] },
//     },
//     {
//       morning: { places: [{ name: "강남 COEX" }, { name: "잠실 롯데월드" }] },
//       afternoon: { places: [{ name: "한강공원" }, { name: "뚝섬" }] },
//     },
//   ],
// };

// const MAP_MARKERS = [
//   { lat: 37.5796, lng: 126.977,  label: "경복궁" },
//   { lat: 37.5764, lng: 126.9856, label: "창덕궁" },
//   { lat: 37.5745, lng: 126.9857, label: "인사동" },
//   { lat: 37.5509, lng: 126.9882, label: "남산서울타워" },
// ];

export default function FocusPage() {

  const store = useOnboardingStore();
  const { data, isLoading: isItineraryLoading } = useQuery({
    queryKey: ['itinerary', store.duration, store.artists, store.regions],
    queryFn: () => fetch(`/kride-api/recommend/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration: store.duration,
        artists: store.artists,
        regions: store.regions,
        purposes: store.purposes,
        budget: store.budget,
      }),
    }).then(r => r.json()),
    enabled: !!store.duration,
  });
  const router = useRouter();
  const { duration } = useOnboardingStore();
  const { data: metadata = [], isLoading: isMetaLoading } = useUiScreen(SCREEN_IDS.FOCUS);

  const safeDuration: TravelDuration = duration ?? "day";
  const itinerary = data?.itinerary ?? [];
  const pageData = {
    duration: safeDuration,
    itinerary,
    mapData: {
      center: [37.5665, 126.978] as [number, number],
      markers: data?.mapData?.markers ?? [],
      zoom: 13,
    },
  };
  const { formData, handleChange, handleAction } = usePageHook(
    SCREEN_IDS.FOCUS,
    metadata,
    pageData
  );

  useEffect(() => {
    if (duration === null) {
      router.replace("/browse");
    }
  }, [duration, router]);

  if (duration === null) return null;

  if (isItineraryLoading || isMetaLoading) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <div className="text-white text-lg">일정 생성 중...</div>
      </div>
    );
  }

  if (metadata.length === 0) {
    return (
      <div className="flex h-screen bg-black overflow-hidden">
        <div className="w-[60%] h-full">
          <MapView id="focus-map" meta={{}} data={pageData.mapData} />
        </div>
        <div className="w-[40%] h-full bg-gray-950 overflow-y-auto p-4">
          <ItineraryPanel
            id="focus-panel"
            meta={{}}
            data={{ duration: safeDuration, itinerary }}
          />
        </div>
      </div>
    );
  }

  return (
    <DynamicEngine
      metadata={metadata}
      screenId={SCREEN_IDS.FOCUS}
      pageData={pageData}
      formData={formData}
      onChange={handleChange}
      onAction={handleAction}
    />
  );
}
