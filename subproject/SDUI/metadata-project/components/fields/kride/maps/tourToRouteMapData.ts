import { TourPoi } from '@/services/tourApi';
import { DEFAULT_ROUTE_MAP_CENTER, DEFAULT_ROUTE_MAP_ZOOM, RouteMapData, RouteMapMarker } from './mapTypes';

type GeoPoi = TourPoi & { mapX: number; mapY: number };

/** 두 지점의 대략적 거리(제곱) — 위도 보정으로 경도 압축을 반영. 정렬용이라 sqrt 불필요. */
function roughDistSq(a: GeoPoi, b: GeoPoi): number {
    const meanLatRad = ((a.mapY + b.mapY) / 2) * (Math.PI / 180);
    const dLat = a.mapY - b.mapY;
    const dLng = (a.mapX - b.mapX) * Math.cos(meanLatRad);
    return dLat * dLat + dLng * dLng;
}

/**
 * 최근접이웃 그리디 정렬 — 첫 지점에서 시작해 매번 가장 가까운 미방문 지점을 잇는다.
 * 하루 동선을 사람이 다닐 만한 순서(A→B→C)로 만든다.
 * Epic #74 · Dev-3(#77).
 */
export function orderByNearestNeighbor(pois: GeoPoi[]): GeoPoi[] {
    if (pois.length <= 2) return [...pois];

    const remaining = [...pois];
    const ordered: GeoPoi[] = [remaining.shift() as GeoPoi];

    while (remaining.length > 0) {
        const last = ordered[ordered.length - 1];
        let nearestIdx = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = roughDistSq(last, remaining[i]);
            if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = i;
            }
        }
        ordered.push(remaining.splice(nearestIdx, 1)[0]);
    }
    return ordered;
}

/**
 * TourAPI POI 배열을 RouteMap(구글/카카오 공용) 데이터로 변환.
 * Epic #74 · Dev-3(#77) — Dev-2 TourAPI 데이터를 기존 지도 인프라에 연결하는 브리지.
 *
 * TourAPI 좌표계: mapX=경도(lng), mapY=위도(lat). 좌표가 없는 POI는 제외하고,
 * 남은 POI를 최근접이웃으로 정렬해 index(동선 순서)를 부여한다.
 */
export function tourPoisToRouteMapData(pois: TourPoi[]): RouteMapData {
    const geoPois = pois.filter(
        (p): p is GeoPoi => typeof p.mapX === 'number' && typeof p.mapY === 'number',
    );
    const ordered = orderByNearestNeighbor(geoPois);

    const markers: RouteMapMarker[] = ordered.map((p, i) => ({
        id: p.contentId ?? `poi-${i}`,
        index: i,
        name: p.title,
        address: p.addr || undefined,
        lat: p.mapY,
        lng: p.mapX,
        imageUrl: p.firstImage || undefined,
    }));

    const center: [number, number] = markers.length
        ? [markers[0].lat, markers[0].lng]
        : DEFAULT_ROUTE_MAP_CENTER;

    return {
        provider: 'google',
        center,
        zoom: DEFAULT_ROUTE_MAP_ZOOM,
        markers,
    };
}
