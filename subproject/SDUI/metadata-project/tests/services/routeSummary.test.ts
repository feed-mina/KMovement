import { haversineKm, routeDistanceKm, estimateMinutes, formatMinutes, groupByDay } from '@/components/fields/kride/maps/routeSummary';
import { RouteMapMarker } from '@/components/fields/kride/maps/mapTypes';

const mk = (over: Partial<RouteMapMarker>): RouteMapMarker => ({
    id: 'x', index: 0, name: 'p', lat: 37.5, lng: 127.0, ...over,
});

describe('routeSummary', () => {
    it('haversineKm: 같은 지점은 0', () => {
        expect(haversineKm({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0);
    });

    it('haversineKm: 서울~부산 대략 320~330km', () => {
        const d = haversineKm({ lat: 37.5665, lng: 126.978 }, { lat: 35.1796, lng: 129.0756 });
        expect(d).toBeGreaterThan(300);
        expect(d).toBeLessThan(340);
    });

    it('routeDistanceKm: 마커 1개 이하는 0', () => {
        expect(routeDistanceKm([])).toBe(0);
        expect(routeDistanceKm([mk({})])).toBe(0);
    });

    it('routeDistanceKm: 연속 마커 거리 합(소수1자리)', () => {
        const d = routeDistanceKm([
            mk({ lat: 37.50, lng: 127.0 }),
            mk({ lat: 37.51, lng: 127.0 }),
            mk({ lat: 37.52, lng: 127.0 }),
        ]);
        expect(d).toBeGreaterThan(0);
        expect(Number.isFinite(d)).toBe(true);
    });

    it('estimateMinutes: 지점당 45분 + 이동시간', () => {
        const one = estimateMinutes([mk({})]);
        expect(one).toBe(45); // 1개, 이동 0
    });

    it('formatMinutes 포맷', () => {
        expect(formatMinutes(45)).toBe('45분');
        expect(formatMinutes(120)).toBe('2시간');
        expect(formatMinutes(90)).toBe('1시간 30분');
    });

    it('groupByDay: day별 그룹 + 정렬, 없으면 1일차', () => {
        const groups = groupByDay([
            mk({ id: 'a', day: 2 }), mk({ id: 'b' }), mk({ id: 'c', day: 2 }), mk({ id: 'd', day: 1 }),
        ]);
        expect(groups.map((g) => g.day)).toEqual([1, 2]);
        expect(groups[0].markers.map((m) => m.id)).toEqual(['b', 'd']); // day 없음→1
        expect(groups[1].markers.map((m) => m.id)).toEqual(['a', 'c']);
    });
});
