import api from '@/services/axios';

/**
 * TourAPI POI (백엔드 /api/v1/tour 정규화 응답).
 * Epic #74 · Dev-3(#77) — Dev-2 백엔드(TourPoiDto)와 필드 일치.
 */
export interface TourPoi {
    contentId?: string;
    contentTypeId?: string;
    title: string;
    addr?: string;
    mapX?: number; // 경도(lng)
    mapY?: number; // 위도(lat)
    firstImage?: string;
    imageSourceUrl?: string;
    imageCredit?: string;
    tel?: string;
    cat1?: string;
    cat2?: string;
    cat3?: string;
    areaCode?: string;
    sigunguCode?: string;
    // 성지 큐레이션 확장 — V76 tour_poi 컬럼(HolyPoiDto)과 정합. #96-A(구 #78)
    artist?: string;
    fandomInfo?: string;
    recommendReason?: string;
    sourceUrl?: string;
}

export interface TourQuery {
    areaCode?: string;
    sigunguCode?: string;
    contentTypeId?: string;
    arrange?: string; // A=제목순, C=수정일순
    numOfRows?: number;
    pageNo?: number;
}

export interface TourRegion {
    code: string;
    name: string;
}

/** 지역기반 관광정보/맛집 POI 조회. ApiResponse.data 언랩. */
export async function fetchTourPois(params: TourQuery = {}): Promise<TourPoi[]> {
    const res = await api.get('/api/v1/tour/poi', { params });
    return res.data?.data ?? [];
}

/** 맛집(음식점, contentTypeId=39) 편의 조회. */
export async function fetchRestaurants(areaCode?: string, numOfRows = 20): Promise<TourPoi[]> {
    const res = await api.get('/api/v1/tour/restaurants', { params: { areaCode, numOfRows } });
    return res.data?.data ?? [];
}

/**
 * 성지(K-컬처) POI 조회 — tour_poi 검수 승인분(V76 파이프라인). #96-A
 * sigunguName: 전국 시드(V90)는 TourAPI 시·군·구 코드가 없어 주소 문자열로 필터한다.
 */
export async function fetchHolyPois(
    params: Pick<TourQuery, 'areaCode' | 'sigunguCode'> & { sigunguName?: string } = {},
): Promise<TourPoi[]> {
    const res = await api.get('/api/v1/tour/holy', { params });
    return res.data?.data ?? [];
}

/** TourAPI 시·도 목록. */
export async function fetchTourAreas(): Promise<TourRegion[]> {
    const res = await api.get('/api/v1/tour/areas');
    return res.data?.data ?? [];
}

/** 선택한 시·도의 시·군·구 목록. */
export async function fetchTourDistricts(areaCode: string): Promise<TourRegion[]> {
    const res = await api.get('/api/v1/tour/areas', { params: { areaCode } });
    return res.data?.data ?? [];
}
