import type { FoodAreaGuide } from './travelContent';

// 시·도 맛집 페이지의 장소 목록을 서버에서 채운다.
// TourAPI 응답이 오면 그것을 쓰고, 실패하거나 비어 있으면 정적 큐레이션으로 되돌아간다.
// 백엔드가 죽어 있어도 빌드가 깨지지 않고 페이지에 항상 내용이 남는 것이 이 모듈의 목적이다.

/** 목록의 출처. 화면에 그대로 표기해 실시간 데이터와 큐레이션을 구분한다. */
export type FoodSpotSource = 'tourapi' | 'curated';

export interface FoodSpotView {
    key: string;
    name: string;
    tag: string;
    district: string;
    body: string;
}

export interface AreaFoodSpots {
    spots: FoodSpotView[];
    spotSource: FoodSpotSource;
    holySpots: FoodSpotView[];
    holySource: FoodSpotSource;
}

interface TourPoiResponse {
    contentId?: string;
    title?: string;
    addr?: string;
    tel?: string;
}

interface HolyPoiResponse extends TourPoiResponse {
    artist?: string;
    fandomInfo?: string;
    recommendReason?: string;
}

/** 한 지역 페이지가 보여줄 최대 장소 수. */
export const SPOT_LIMIT = 9;
const FETCH_TIMEOUT_MS = 4000;
const REVALIDATE_SECONDS = 3600;

/** next.config.ts의 BACKEND_URL 결정 규칙과 같은 순서를 따른다. */
export function resolveBackendBaseUrl(): string {
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:8080';
    return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://yerin.duckdns.org';
}

/**
 * 주소 문자열에서 해당 지역의 시·군·구를 찾아낸다.
 * TourAPI 주소는 '부산광역시 중구 …' 형태라 지역 목록과 대조하면 칩 표기를 맞출 수 있다.
 * 찾지 못하면 시·도 이름으로 되돌린다 — 빈 칸을 두지 않기 위해서다.
 */
export function districtFromAddress(addr: string | undefined, area: FoodAreaGuide): string {
    if (!addr) return area.name;
    // 긴 이름부터 확인해야 '중구'가 '서중구' 같은 이름을 가로채지 않는다.
    const ordered = [...area.districts].sort((a, b) => b.length - a.length);
    return ordered.find((district) => addr.includes(district)) ?? area.name;
}

function toSpotView(poi: TourPoiResponse, area: FoodAreaGuide, index: number): FoodSpotView | null {
    const name = poi.title?.trim();
    if (!name) return null;
    return {
        key: poi.contentId || `${area.slug}-spot-${index}`,
        name,
        tag: '맛집',
        district: districtFromAddress(poi.addr, area),
        body: poi.addr?.trim() || `${area.fullName}의 음식점입니다.`,
    };
}

function toHolySpotView(poi: HolyPoiResponse, area: FoodAreaGuide, index: number): FoodSpotView | null {
    const name = poi.title?.trim();
    if (!name) return null;
    return {
        key: poi.contentId || `${area.slug}-holy-${index}`,
        name,
        tag: poi.artist?.trim() || '성지 맛집',
        district: districtFromAddress(poi.addr, area),
        body: poi.recommendReason?.trim() || poi.fandomInfo?.trim() || poi.addr?.trim() || `${area.fullName}의 촬영지 식당입니다.`,
    };
}

export function curatedSpotViews(area: FoodAreaGuide): FoodSpotView[] {
    return area.signatureSpots.map((spot) => ({
        key: `${area.slug}-${spot.name}`,
        name: spot.name,
        tag: spot.category,
        district: spot.district,
        body: spot.reason,
    }));
}

export function curatedHolyViews(area: FoodAreaGuide): FoodSpotView[] {
    return area.holySpots.map((spot) => ({
        key: `${area.slug}-holy-${spot.name}`,
        name: spot.name,
        tag: spot.content,
        district: spot.district,
        body: spot.note,
    }));
}

/**
 * 백엔드 ApiResponse의 data 배열을 꺼낸다.
 * 네트워크 오류·비정상 응답·타임아웃은 모두 빈 배열로 흡수한다 — 호출 측이 큐레이션으로 되돌리도록.
 */
async function fetchList<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const url = new URL(path, resolveBackendBaseUrl());
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url.toString(), {
            signal: controller.signal,
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload?.data) ? (payload.data as T[]) : [];
    } catch {
        // 빌드 시점에 백엔드가 없을 수 있다. 여기서 삼키고 큐레이션으로 되돌린다.
        return [];
    } finally {
        clearTimeout(timer);
    }
}

export async function loadAreaFoodSpots(area: FoodAreaGuide): Promise<AreaFoodSpots> {
    const [pois, holyPois] = await Promise.all([
        fetchList<TourPoiResponse>('/api/v1/tour/poi', {
            areaCode: area.areaCode,
            contentTypeId: '39',
            arrange: 'A',
            numOfRows: String(SPOT_LIMIT),
        }),
        fetchList<HolyPoiResponse>('/api/v1/tour/holy', {
            areaCode: area.areaCode,
            kind: 'FOOD',
        }),
    ]);

    const spots = pois
        .map((poi, index) => toSpotView(poi, area, index))
        .filter((spot): spot is FoodSpotView => spot !== null)
        .slice(0, SPOT_LIMIT);

    const holySpots = holyPois
        .map((poi, index) => toHolySpotView(poi, area, index))
        .filter((spot): spot is FoodSpotView => spot !== null)
        .slice(0, SPOT_LIMIT);

    return {
        spots: spots.length > 0 ? spots : curatedSpotViews(area),
        spotSource: spots.length > 0 ? 'tourapi' : 'curated',
        holySpots: holySpots.length > 0 ? holySpots : curatedHolyViews(area),
        holySource: holySpots.length > 0 ? 'tourapi' : 'curated',
    };
}
