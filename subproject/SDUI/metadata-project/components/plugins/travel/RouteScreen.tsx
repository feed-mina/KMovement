'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import RouteMap from '@/components/fields/kride/maps/RouteMap';
import { tourPoisToRouteMapData } from '@/components/fields/kride/maps/tourToRouteMapData';
import { fetchRestaurants, TourPoi } from '@/services/tourApi';

// [동선] 화면 컨트롤러 (여행 플러그인).
// TourAPI POI(Dev-2)를 불러와 기존 지도 인프라(RouteMap)로 하루 동선을 표시한다.
// Epic #74 · Dev-3(#77).
export default function RouteScreen(_props: ScreenControllerProps) {
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetchRestaurants('1', 30)
            .then((list) => { if (alive) setPois(list); })
            .catch(() => { if (alive) setError('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    const data = useMemo(() => tourPoisToRouteMapData(pois), [pois]);

    return (
        <div className="page-wrap ROUTE_PLANNER route-screen" style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
            <header className="route-screen-header" style={{ padding: '14px 16px', borderBottom: '0.5px solid #eee', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#E50914' }}>동선</span>
                <span style={{ fontSize: 13, color: '#888' }}>성지·맛집을 하루 코스로</span>
            </header>

            {loading && <div style={{ padding: 24, color: '#888' }}>불러오는 중…</div>}
            {error && <div style={{ padding: 24, color: '#A32D2D' }}>{error}</div>}

            {!loading && !error && (
                <div className="map-view w-full" style={{ flex: 1, minHeight: 400 }}>
                    <RouteMap data={data} />
                </div>
            )}
        </div>
    );
}
