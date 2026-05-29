// ─────────────────────────────────────────────────────────────────────────────
// metadata-project/lib/types/krideChat.ts
//
// KRIDE 챗봇 DTO 타입 — 백엔드 `ChatQueryRequest` / `ChatQueryResponse` 와 매칭.
// 백엔드 변경 없이 프론트에서만 추가하는 타입.
// ─────────────────────────────────────────────────────────────────────────────

/** 백엔드 ChatQueryRequest.java 와 1:1 대응 */
export interface KrideChatRequest {
  message: string;
  intent?: 'itinerary' | 'recommend' | 'qa';
  artists?: string[];
  regions?: string[];
  purposes?: string[];
  duration?: number;
  budget?: [number, number];
}

/** 백엔드 ChatQueryResponse.java 와 1:1 대응 */
export interface KrideChatResponse {
  intent: 'itinerary' | 'recommend' | 'qa';
  reply: string;
  pois?: KridePoi[];
  recommendationText?: string;
  itinerary?: KrideItinerary;
}

/** FastAPI /api/recommend/ai 의 pois 배열 element — Map<String, Object> 라 유연한 타입 */
export interface KridePoi {
  id?: number | string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  tag?: string;     // 카테고리 (맛집/문화/랜드마크 등)
  distance?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

/** FastAPI /api/recommend/itinerary 응답 구조 (Map<String, Object>) */
export interface KrideItinerary {
  duration?: string;          // "1박2일" 등
  days?: KrideDayPlan[];
  [key: string]: unknown;
}

export interface KrideDayPlan {
  day: number;
  morning: { places: KridePlaceStop[] };
  afternoon: { places: KridePlaceStop[] };
}

export interface KridePlaceStop {
  name: string;
  desc?: string;
  description?: string;       // 백엔드 표기 다를 수 있음 — 둘 다 허용
  lat?: number;
  lng?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 클라이언트 상태 타입 — 채팅 메시지 (DTO 와 별개)
// ─────────────────────────────────────────────────────────────────────────────

export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
  pois?: KridePoi[];
  itinerary?: KrideItinerary;
  /** 스트리밍 중인 마지막 어시스턴트 메시지 표시용 */
  streaming?: boolean;
  /** 에러 발생 시 표시용 */
  error?: string;
}

/** localStorage['kride_form'] 에 저장되는 사용자 컨텍스트 — 온보딩 5단계의 결과 */
export interface KrideForm {
  duration?: string;          // "당일치기" | "1박2일" | "2박3일"
  selectedArtists?: Array<{ id: number; name: string; imageUrl?: string }>;
  selectedRegions?: Array<{ id: number; name: string; imageUrl?: string }>;
  purposes?: string[];        // ['food', 'kculture', ...]
  budget?: [number, number];
}
