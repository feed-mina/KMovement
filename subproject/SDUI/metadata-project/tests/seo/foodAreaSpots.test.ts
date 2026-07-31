import {
    curatedSpotViews,
    districtFromAddress,
    loadAreaFoodSpots,
    resolveBackendBaseUrl,
    SPOT_LIMIT,
} from '@/lib/seo/foodAreaSpots';
import { findFoodArea } from '@/lib/seo/travelContent';

const busan = findFoodArea('busan')!;

function jsonResponse(data: unknown) {
    return { ok: true, json: async () => ({ data }) } as unknown as Response;
}

function poi(title: string, addr?: string, extra: Record<string, unknown> = {}) {
    return { contentId: `c-${title}`, title, addr, ...extra };
}

/** /poi 와 /holy 요청을 각각 다른 응답으로 연결한다. */
function mockFetch(routes: { poi?: unknown[]; holy?: unknown[]; failPoi?: boolean; failHoly?: boolean }) {
    return jest.fn(async (input: string) => {
        const isHoly = input.includes('/tour/holy');
        if (isHoly) {
            if (routes.failHoly) throw new Error('network down');
            return jsonResponse(routes.holy ?? []);
        }
        if (routes.failPoi) throw new Error('network down');
        return jsonResponse(routes.poi ?? []);
    });
}

describe('districtFromAddress', () => {
    it('주소에서 해당 지역의 시·군·구를 찾는다', () => {
        expect(districtFromAddress('부산광역시 해운대구 우동 1411', busan)).toBe('해운대구');
        expect(districtFromAddress('부산광역시 기장군 기장읍', busan)).toBe('기장군');
    });

    it('더 긴 이름을 먼저 맞춘다', () => {
        const area = { ...busan, districts: ['중구', '서중구'] };
        expect(districtFromAddress('부산광역시 서중구 어딘가', area)).toBe('서중구');
    });

    it('찾지 못하거나 주소가 없으면 시·도 이름으로 되돌린다', () => {
        expect(districtFromAddress('제주특별자치도 제주시', busan)).toBe('부산');
        expect(districtFromAddress(undefined, busan)).toBe('부산');
    });
});

describe('resolveBackendBaseUrl', () => {
    it('개발·테스트 환경에서는 로컬 백엔드를 본다', () => {
        expect(resolveBackendBaseUrl()).toBe('http://localhost:8080');
    });
});

describe('loadAreaFoodSpots', () => {
    const originalFetch = global.fetch;
    afterEach(() => { global.fetch = originalFetch; });

    it('TourAPI 응답이 오면 그것으로 목록을 채운다', async () => {
        global.fetch = mockFetch({
            poi: [poi('자갈치시장', '부산광역시 중구 자갈치해안로')],
            holy: [poi('감천문화마을 카페', '부산광역시 사하구 감내2로', { artist: '드라마 촬영지', recommendReason: '골목 전망대와 이어집니다.' })],
        }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        expect(result.spotSource).toBe('tourapi');
        expect(result.spots[0]).toMatchObject({ name: '자갈치시장', district: '중구', tag: '맛집' });
        expect(result.holySource).toBe('tourapi');
        expect(result.holySpots[0]).toMatchObject({ name: '감천문화마을 카페', district: '사하구', tag: '드라마 촬영지' });
        expect(result.holySpots[0].body).toBe('골목 전망대와 이어집니다.');
    });

    it('썸네일 URL을 검증해 담고, 성지는 권리 표기를 함께 싣는다', async () => {
        global.fetch = mockFetch({
            poi: [
                poi('자갈치시장', '부산광역시 중구', { firstImage: 'http://tong.visitkorea.or.kr/a.jpg' }),
                poi('국제시장', '부산광역시 중구', { firstImage: 'javascript:alert(1)' }),
                poi('전포카페거리', '부산광역시 부산진구'),
            ],
            holy: [poi('감천문화마을 카페', '부산광역시 사하구', {
                firstImage: 'https://images.example.com/g.jpg',
                imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:G.jpg',
                imageCredit: 'Bgag · CC0 1.0',
            })],
        }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        // http는 https로 올리고, http(s)가 아닌 값과 부재는 담지 않는다.
        expect(result.spots[0].image).toBe('https://tong.visitkorea.or.kr/a.jpg');
        expect(result.spots[1].image).toBeUndefined();
        expect(result.spots[2].image).toBeUndefined();

        expect(result.holySpots[0]).toMatchObject({
            image: 'https://images.example.com/g.jpg',
            imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:G.jpg',
            imageCredit: 'Bgag · CC0 1.0',
        });
    });

    it('출처 링크와 표기 중 하나만 있으면 권리 표기를 붙이지 않는다', async () => {
        global.fetch = mockFetch({
            holy: [
                poi('출처만', '부산광역시 중구', { imageSourceUrl: 'https://example.com/src' }),
                poi('표기만', '부산광역시 중구', { imageCredit: 'Someone' }),
            ],
        }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        expect(result.holySpots[0].imageCredit).toBeUndefined();
        expect(result.holySpots[1].imageSourceUrl).toBeUndefined();
    });

    it('큐레이션 폴백에는 썸네일이 없다', async () => {
        global.fetch = mockFetch({ poi: [], holy: [] }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        expect(result.spots.every((spot) => spot.image === undefined)).toBe(true);
        expect(result.holySpots.every((spot) => spot.image === undefined)).toBe(true);
    });

    it('네트워크 오류에는 큐레이션으로 되돌린다', async () => {
        global.fetch = mockFetch({ failPoi: true, failHoly: true }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        expect(result.spotSource).toBe('curated');
        expect(result.spots).toEqual(curatedSpotViews(busan));
        expect(result.holySource).toBe('curated');
        expect(result.holySpots).toHaveLength(busan.holySpots.length);
    });

    it('빈 응답도 큐레이션으로 되돌린다', async () => {
        global.fetch = mockFetch({ poi: [], holy: [] }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        expect(result.spotSource).toBe('curated');
        expect(result.holySource).toBe('curated');
    });

    it('한쪽만 실패하면 그쪽만 큐레이션으로 되돌린다', async () => {
        global.fetch = mockFetch({
            poi: [poi('국제시장 먹자골목', '부산광역시 중구 신창동')],
            failHoly: true,
        }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        expect(result.spotSource).toBe('tourapi');
        expect(result.holySource).toBe('curated');
    });

    it('비정상 응답(HTTP 500, 배열 아닌 payload)을 큐레이션으로 흡수한다', async () => {
        global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
        await expect(loadAreaFoodSpots(busan)).resolves.toMatchObject({ spotSource: 'curated' });

        global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: null }) })) as unknown as typeof fetch;
        await expect(loadAreaFoodSpots(busan)).resolves.toMatchObject({ spotSource: 'curated' });
    });

    it('제목이 없는 항목은 버리고 상한까지만 남긴다', async () => {
        const many = Array.from({ length: SPOT_LIMIT + 5 }, (_, i) => poi(`가게 ${i}`, '부산광역시 중구'));
        global.fetch = mockFetch({ poi: [...many, { contentId: 'blank', title: '   ' }] }) as unknown as typeof fetch;

        const result = await loadAreaFoodSpots(busan);

        expect(result.spots).toHaveLength(SPOT_LIMIT);
        expect(result.spots.every((spot) => spot.name.trim().length > 0)).toBe(true);
    });

    it('TourAPI 시·도 코드와 음식점 타입으로 조회한다', async () => {
        const fetchMock = mockFetch({ poi: [], holy: [] });
        global.fetch = fetchMock as unknown as typeof fetch;

        await loadAreaFoodSpots(busan);

        const urls = fetchMock.mock.calls.map(([input]) => String(input));
        const poiUrl = new URL(urls.find((url) => url.includes('/tour/poi'))!);
        expect(poiUrl.searchParams.get('areaCode')).toBe(busan.areaCode);
        expect(poiUrl.searchParams.get('contentTypeId')).toBe('39');

        const holyUrl = new URL(urls.find((url) => url.includes('/tour/holy'))!);
        expect(holyUrl.searchParams.get('areaCode')).toBe(busan.areaCode);
        expect(holyUrl.searchParams.get('kind')).toBe('FOOD');
    });
});
