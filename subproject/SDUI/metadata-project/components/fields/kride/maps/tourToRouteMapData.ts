import { TourPoi } from '@/services/tourApi';
import { DEFAULT_ROUTE_MAP_CENTER, DEFAULT_ROUTE_MAP_ZOOM, RouteMapData, RouteMapMarker } from './mapTypes';

/**
 * TourAPI POI 배열을 RouteMap(구글/카카오 공용) 데이터로 변환.
 * Epic #74 · Dev-3(#77) — Dev-2 TourAPI 데이터를 기존 지도 인프라에 연결하는 브리지.
 *
 * TourAPI 좌표계: mapX=경도(lng), mapY=위도(lat).
 * 좌표가 없는 POI는 마커에서 제외한다.
 */
export function tourPoisToRouteMapData(pois: TourPoi[]): RouteMapData {
    const markers: RouteMapMarker[] = pois
        .filter((p) => typeof p.mapX === 'number' && typeof p.mapY === 'number')
        .map((p, i) => ({
            id: p.contentId ?? `poi-${i}`,
            index: i,
            name: p.title,
            address: p.addr || undefined,
            lat: p.mapY as number,
            lng: p.mapX as number,
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
