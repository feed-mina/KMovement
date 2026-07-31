import { curatedKpopHolyViews, loadAreaKpopSpots } from '@/lib/seo/kpopAreaSpots';
import { findKpopArea, foodAreaSlugs, kpopAreaPath, kpopAreas, kpopAreaSlugs } from '@/lib/seo/travelContent';

const seoul = findKpopArea('seoul')!;

function jsonResponse(data: unknown) {
    return { ok: true, json: async () => ({ data }) } as unknown as Response;
}

describe('K-POP 지역 데이터', () => {
    it('공연장·성지가 모인 지역만 담고 중복이 없다', () => {
        expect(kpopAreas.length).toBeGreaterThanOrEqual(5);
        expect(new Set(kpopAreaSlugs).size).toBe(kpopAreas.length);
        // 맛집과 달리 17개 전부를 만들지 않는다 — 빈 지역 페이지를 찍지 않기 위한 결정.
        expect(kpopAreas.length).toBeLessThan(foodAreaSlugs.length);
    });

    it('slug 와 시·도 코드가 맛집 쪽과 같은 체계를 쓴다', () => {
        kpopAreas.forEach((area) => {
            expect(area.slug).toMatch(/^[a-z]+$/);
            expect(area.areaCode).toMatch(/^\d+$/);
            expect(kpopAreaPath(area.slug)).toBe(`/travel/kpop/${area.slug}`);
        });
        expect(new Set(kpopAreas.map((a) => a.areaCode)).size).toBe(kpopAreas.length);
    });

    it('모든 지역이 권역·성지·시·군·구를 채운다', () => {
        kpopAreas.forEach((area) => {
            expect(area.highlights.length).toBeGreaterThanOrEqual(3);
            expect(area.holySpots.length).toBeGreaterThanOrEqual(2);
            expect(area.districts.length).toBeGreaterThanOrEqual(5);
        });
    });

    it('성지의 시·군·구가 해당 지역 목록 안에 있다', () => {
        kpopAreas.forEach((area) => {
            const districts = new Set(area.districts);
            area.holySpots.forEach((spot) => expect(districts.has(spot.district)).toBe(true));
        });
    });

    it('인접 지역 링크가 K-POP 페이지가 있는 지역만 가리킨다', () => {
        kpopAreas.forEach((area) => {
            expect(area.neighbors.length).toBeGreaterThan(0);
            area.neighbors.forEach((slug) => {
                expect(slug).not.toBe(area.slug);
                // 맛집에는 있어도 K-POP 페이지가 없는 지역으로 링크하면 404가 된다.
                expect(findKpopArea(slug)).toBeDefined();
            });
        });
    });
});

describe('loadAreaKpopSpots', () => {
    const originalFetch = global.fetch;
    afterEach(() => { global.fetch = originalFetch; });

    it('성지 API 응답을 kind 필터 없이 지역 전체로 조회한다', async () => {
        const requested: string[] = [];
        global.fetch = (async (input: string) => {
            requested.push(String(input));
            return jsonResponse([]);
        }) as unknown as typeof fetch;

        await loadAreaKpopSpots(seoul);

        const url = new URL(requested[0]);
        expect(url.pathname).toBe('/api/v1/tour/holy');
        expect(url.searchParams.get('areaCode')).toBe(seoul.areaCode);
        // 맛집 페이지와 달리 식당만 거르지 않는다.
        expect(url.searchParams.get('kind')).toBeNull();
    });

    it('응답이 오면 그것으로 채우고 출처를 성지 DB로 표시한다', async () => {
        global.fetch = jest.fn(async () => jsonResponse([
            { contentId: 'h1', title: '홍대 걷고싶은거리', addr: '서울특별시 마포구 어울마당로', artist: 'BTS' },
        ])) as unknown as typeof fetch;

        const result = await loadAreaKpopSpots(seoul);

        expect(result.holySource).toBe('tourapi');
        expect(result.holySpots[0]).toMatchObject({ name: '홍대 걷고싶은거리', district: '마포구', tag: 'BTS' });
    });

    it('작품·아티스트가 비면 K-POP 기본 표기를 쓴다', async () => {
        global.fetch = jest.fn(async () => jsonResponse([
            { contentId: 'h2', title: '이름만 있는 성지' },
        ])) as unknown as typeof fetch;

        const result = await loadAreaKpopSpots(seoul);

        // 맛집 쪽 기본값('성지 맛집')이 새어 나오면 안 된다.
        expect(result.holySpots[0].tag).toBe('K-컬처 성지');
        expect(result.holySpots[0].body).toContain('촬영지·팬 방문지');
    });

    it('빈 응답과 네트워크 오류 모두 큐레이션으로 되돌린다', async () => {
        global.fetch = jest.fn(async () => jsonResponse([])) as unknown as typeof fetch;
        await expect(loadAreaKpopSpots(seoul)).resolves.toEqual({
            holySpots: curatedKpopHolyViews(seoul),
            holySource: 'curated',
        });

        global.fetch = jest.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
        await expect(loadAreaKpopSpots(seoul)).resolves.toMatchObject({ holySource: 'curated' });
    });
});
