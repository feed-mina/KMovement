import {
    fetchList,
    SPOT_LIMIT,
    toHolySpotView,
    type FoodSpotSource,
    type FoodSpotView,
    type HolyPoiResponse,
} from './foodAreaSpots';
import type { KpopAreaGuide } from './travelContent';

// K-POP 시·도 페이지의 성지 목록을 서버에서 채운다.
// 맛집과 같은 성지 API 를 쓰되 kind 필터 없이 지역 전체 성지를 가져온다.
// 응답이 비거나 실패하면 권역 큐레이션으로 되돌아간다.

export interface AreaKpopSpots {
    holySpots: FoodSpotView[];
    holySource: FoodSpotSource;
}

const KPOP_HOLY_DEFAULTS = { tag: 'K-컬처 성지', body: '촬영지·팬 방문지입니다.' };

export function curatedKpopHolyViews(area: KpopAreaGuide): FoodSpotView[] {
    return area.holySpots.map((spot) => ({
        key: `${area.slug}-kpop-${spot.name}`,
        name: spot.name,
        tag: spot.content,
        district: spot.district,
        body: spot.note,
    }));
}

export async function loadAreaKpopSpots(area: KpopAreaGuide): Promise<AreaKpopSpots> {
    const holyPois = await fetchList<HolyPoiResponse>('/api/v1/tour/holy', {
        areaCode: area.areaCode,
    });

    const holySpots = holyPois
        .map((poi, index) => toHolySpotView(poi, area, index, KPOP_HOLY_DEFAULTS))
        .filter((spot): spot is FoodSpotView => spot !== null)
        .slice(0, SPOT_LIMIT);

    return {
        holySpots: holySpots.length > 0 ? holySpots : curatedKpopHolyViews(area),
        holySource: holySpots.length > 0 ? 'tourapi' : 'curated',
    };
}
