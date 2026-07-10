import { RouteMapMarker } from './mapTypes';

/** 두 좌표 사이 거리(km) — 하버사인. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** 마커를 index 순서대로 이은 총 이동 거리(km, 소수1자리). */
export function routeDistanceKm(markers: RouteMapMarker[]): number {
    if (markers.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < markers.length; i++) sum += haversineKm(markers[i - 1], markers[i]);
    return Math.round(sum * 10) / 10;
}

/** 대략적 소요 시간(분): 지점당 체류 45분 + 이동 15분/km. */
export function estimateMinutes(markers: RouteMapMarker[]): number {
    if (markers.length === 0) return 0;
    const stay = markers.length * 45;
    const travel = routeDistanceKm(markers) * 15;
    return Math.round(stay + travel);
}

/** "6시간 30분" 형태로 포맷. */
export function formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export interface DayGroup {
    day: number;
    markers: RouteMapMarker[];
}

/** 마커를 day(없으면 1)별로 묶는다. day 순 정렬. */
export function groupByDay(markers: RouteMapMarker[]): DayGroup[] {
    const map = new Map<number, RouteMapMarker[]>();
    markers.forEach((m) => {
        const day = m.day && m.day > 0 ? m.day : 1;
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(m);
    });
    return [...map.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([day, ms]) => ({ day, markers: ms }));
}
