import { tourPoisToRouteMapData, orderByNearestNeighbor } from '@/components/fields/kride/maps/tourToRouteMapData';
import { DEFAULT_ROUTE_MAP_CENTER } from '@/components/fields/kride/maps/mapTypes';
import { TourPoi } from '@/services/tourApi';

describe('tourPoisToRouteMapData — TourAPI → 지도 데이터 브리지', () => {
    const poi = (over: Partial<TourPoi> = {}): TourPoi => ({
        contentId: '2871024',
        title: '가나돈까스의집',
        addr: '서울특별시 강남구 언주로 608',
        mapX: 127.0377755568,
        mapY: 37.5099674377,
        firstImage: 'http://img/x.jpg',
        ...over,
    });

    it('mapX=경도, mapY=위도로 매핑해야 함', () => {
        const data = tourPoisToRouteMapData([poi()]);
        expect(data.markers).toHaveLength(1);
        expect(data.markers[0]).toMatchObject({
            id: '2871024',
            index: 0,
            name: '가나돈까스의집',
            lat: 37.5099674377,
            lng: 127.0377755568,
            imageUrl: 'http://img/x.jpg',
        });
        expect(data.provider).toBe('google');
    });

    it('좌표 없는 POI는 마커에서 제외해야 함', () => {
        const data = tourPoisToRouteMapData([poi(), poi({ mapX: undefined, mapY: undefined, contentId: 'no-geo' })]);
        expect(data.markers).toHaveLength(1);
        expect(data.markers.map((m) => m.id)).not.toContain('no-geo');
    });

    it('첫 마커를 지도 중심으로 잡아야 함', () => {
        const data = tourPoisToRouteMapData([poi({ mapX: 129.0, mapY: 35.1 })]);
        expect(data.center).toEqual([35.1, 129.0]);
    });

    it('POI가 없으면 기본 중심(서울)을 사용해야 함', () => {
        const data = tourPoisToRouteMapData([]);
        expect(data.markers).toHaveLength(0);
        expect(data.center).toEqual(DEFAULT_ROUTE_MAP_CENTER);
    });

    it('contentId가 없으면 index 기반 id를 부여해야 함', () => {
        const data = tourPoisToRouteMapData([poi({ contentId: undefined })]);
        expect(data.markers[0].id).toBe('poi-0');
    });
});

describe('orderByNearestNeighbor — 하루 동선 정렬', () => {
    const at = (id: string, lat: number, lng: number): TourPoi => ({
        contentId: id, title: id, mapX: lng, mapY: lat,
    });

    it('첫 지점에서 가장 가까운 순으로 이어야 함', () => {
        // 위도로 일렬 배치, 입력은 뒤섞음. A에서 시작 → B → C → D 기대
        const A = at('A', 37.50, 127.0);
        const B = at('B', 37.51, 127.0);
        const C = at('C', 37.52, 127.0);
        const D = at('D', 37.53, 127.0);
        const ordered = orderByNearestNeighbor([A, D, B, C] as any);
        expect(ordered.map((p) => p.contentId)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('2개 이하는 그대로 반환', () => {
        const A = at('A', 37.5, 127.0);
        const B = at('B', 37.6, 127.1);
        expect(orderByNearestNeighbor([A, B] as any).map((p) => p.contentId)).toEqual(['A', 'B']);
    });

    it('tourPoisToRouteMapData의 marker index가 동선 순서를 따라야 함', () => {
        const data = tourPoisToRouteMapData([
            at('A', 37.50, 127.0), at('D', 37.53, 127.0), at('B', 37.51, 127.0), at('C', 37.52, 127.0),
        ]);
        expect(data.markers.map((m) => m.id)).toEqual(['A', 'B', 'C', 'D']);
        expect(data.markers.map((m) => m.index)).toEqual([0, 1, 2, 3]);
    });
});
