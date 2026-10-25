import { searchDirectionPlaces, kakaoDirectionsUrl, googleDirectionsUrl } from '@/lib/kride/directions';
import { loadKakaoMaps } from '@/components/fields/kride/maps/loadKakaoMaps';
jest.mock('@/components/fields/kride/maps/loadKakaoMaps', () => ({ loadKakaoMaps: jest.fn() }));

const keywordSearch = jest.fn();
const addressSearch = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (loadKakaoMaps as jest.Mock).mockResolvedValue({ maps: { services: {
        Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' },
        Places: function () { return { keywordSearch }; },
        Geocoder: function () { return { addressSearch }; },
    } } });
    keywordSearch.mockImplementation((_q, callback) => callback([], 'ZERO_RESULT'));
    addressSearch.mockImplementation((_q, callback) => callback([], 'ZERO_RESULT'));
});

test('searches place names and addresses, combining only valid, distinct coordinates', async () => {
    keywordSearch.mockImplementation((_q, callback) => callback([
        { id: 'b', place_name: '부산역', road_address_name: '부산 동구 중앙대로 206', x: '129.0414', y: '35.1151' },
        { id: 'bad', place_name: 'invalid', x: 'NaN', y: '35' },
    ], 'OK'));
    addressSearch.mockImplementation((_q, callback) => callback([
        { address_name: '부산 동구 중앙대로 206', x: '129.0414', y: '35.1151' },
    ], 'OK'));
    expect(await searchDirectionPlaces('부산역', '부산')).toEqual([
        { id: 'b', name: '부산역', address: '부산 동구 중앙대로 206', lat: 35.1151, lon: 129.0414 },
    ]);
    expect(keywordSearch.mock.calls[0][0]).toBe('부산역');
    expect(addressSearch.mock.calls[0][0]).toBe('부산역');
});

test('biases destination search but never the origin, or an explicitly named other city', async () => {
    await searchDirectionPlaces('시청', '부산');
    expect(keywordSearch.mock.calls[0][0]).toBe('부산 시청');
    await searchDirectionPlaces('서울역', '부산');
    expect(keywordSearch.mock.calls[1][0]).toBe('서울역');
    await searchDirectionPlaces('시청');
    expect(keywordSearch.mock.calls[2][0]).toBe('시청');
});

test('keeps address results if keyword search fails', async () => {
    keywordSearch.mockImplementation((_q, callback) => callback([], 'ERROR'));
    addressSearch.mockImplementation((_q, callback) => callback([
        { address_name: '부산 중구', x: '129', y: '35' },
    ], 'OK'));
    expect(await searchDirectionPlaces('부산 중구')).toHaveLength(1);
});

test('encodes place names without allowing them to inject URL path separators', () => {
    const p = { id: 'a', name: 'A/B & 카페', lat: 35, lon: 129 };
    expect(kakaoDirectionsUrl(p, { ...p, name: '목적지' })).toContain('A%2FB%20%26%20');
    const url = new URL(googleDirectionsUrl('부산역', '해운대해수욕장'));
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('부산역');
    expect(url.searchParams.get('destination')).toBe('해운대해수욕장');
});
