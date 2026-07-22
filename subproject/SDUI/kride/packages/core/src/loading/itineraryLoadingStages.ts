export const ITINERARY_LOADING_STAGE_INTERVAL_MS = 4_500;

export const ITINERARY_LOADING_STAGES = [
  {
    id: 'preferences',
    label: '취향 분석',
    message: '여행 취향을 살펴보고 있어요',
  },
  {
    id: 'route',
    label: '동선 구성',
    message: '장소와 이동 동선을 맞추고 있어요',
  },
  {
    id: 'polish',
    label: '코스 정리',
    message: '라이의 추천 코스를 정리하고 있어요',
  },
] as const;

export type ItineraryLoadingStage = (typeof ITINERARY_LOADING_STAGES)[number];

export const nextItineraryLoadingStage = (currentIndex: number) => (
  (currentIndex + 1) % ITINERARY_LOADING_STAGES.length
);
