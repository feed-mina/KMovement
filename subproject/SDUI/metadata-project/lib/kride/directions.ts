import { loadKakaoMaps } from '@/components/fields/kride/maps/loadKakaoMaps';

export type DirectionPlace = { id: string; name: string; address?: string; lat: number; lon: number };

export function validDirectionPlace(place: DirectionPlace): boolean {
    return Number.isFinite(place.lat) && Number.isFinite(place.lon)
        && Math.abs(place.lat) <= 90 && Math.abs(place.lon) <= 180;
}

export function kakaoDirectionsUrl(start: DirectionPlace, end: DirectionPlace): string {
    const point = (p: DirectionPlace) => `${encodeURIComponent(p.name)},${p.lat},${p.lon}`;
    return `https://map.kakao.com/link/from/${point(start)}/to/${point(end)}`;
}

export function googleDirectionsUrl(start: DirectionPlace | string, end: DirectionPlace | string): string {
    const point = (p: DirectionPlace | string) => typeof p === 'string' ? p : `${p.lat},${p.lon}`;
    return 'https://www.google.com/maps/dir/?' + new URLSearchParams({ api: '1', origin: point(start), destination: point(end) });
}

/** A text match is only a candidate: the user chooses its exact address. */
export async function searchDirectionPlaces(query: string, region?: string): Promise<DirectionPlace[]> {
    const kakao = await loadKakaoMaps(process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? '');
    if (!kakao.maps.services) throw new Error('place_search_unavailable');
    const search = (method: 'keywordSearch' | 'addressSearch', text: string): Promise<DirectionPlace[]> => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('place_search_timeout')), 8000);
        const callback = (rows: Record<string, string>[], status: string) => {
            clearTimeout(timer);
            if (status === kakao.maps.services.Status.ZERO_RESULT) return resolve([]);
            if (status !== kakao.maps.services.Status.OK) return reject(new Error('place_search_failed'));
            resolve(rows.filter(row => row.x?.trim() && row.y?.trim() && (row.place_name || row.address_name)).map((row, index) => ({
                id: row.id || `${row.x}:${row.y}:${index}`,
                name: row.place_name || row.address_name,
                address: row.road_address_name || row.address_name,
                lat: Number(row.y), lon: Number(row.x),
            })).filter(validDirectionPlace));
        };
        try {
            if (method === 'keywordSearch') new kakao.maps.services.Places().keywordSearch(text, callback, { size: 5 });
            else new kakao.maps.services.Geocoder().addressSearch(text, callback);
        } catch (error) { clearTimeout(timer); reject(error); }
    });
    // Origin can be in another city. Only bias destination keywords, never rewrite an explicit city.
    const explicitRegion = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/.test(query);
    const keyword = region && !explicitRegion ? `${region} ${query}` : query;
    const [places, addresses] = await Promise.allSettled([search('keywordSearch', keyword), search('addressSearch', query)]);
    if (places.status === 'rejected' && addresses.status === 'rejected') throw new Error('place_search_failed');
    const rows = [...(places.status === 'fulfilled' ? places.value : []), ...(addresses.status === 'fulfilled' ? addresses.value : [])];
    return rows.filter((row, i) => rows.findIndex(other => other.lat === row.lat && other.lon === row.lon) === i).slice(0, 8);
}
