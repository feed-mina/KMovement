'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import RouteMap from '@/components/fields/kride/maps/RouteMap';
import { tourPoisToRouteMapData } from '@/components/fields/kride/maps/tourToRouteMapData';
import { normalizeRouteMapData } from '@/components/fields/kride/maps/normalizeRouteMapData';
import { fetchRestaurants, TourPoi } from '@/services/tourApi';

// [동선] 화면 컨트롤러 (여행 플러그인).
// 기본: TourAPI POI(Dev-2)를 최근접이웃으로 정렬. AI 코스: FastAPI 추천 일정(#77).
// Epic #74 · Dev-3(#77).
export default function RouteScreen(_props: ScreenControllerProps) {
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [mode, setMode] = useState<'tour' | 'ai'>('tour');
    const [aiData, setAiData] = useState<unknown | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetchRestaurants('1', 12)
            .then((list) => { if (alive) setPois(list); })
            .catch(() => { if (alive) setError('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    const tourData = useMemo(() => tourPoisToRouteMapData(pois), [pois]);
    const aiRouteData = useMemo(() => (aiData ? normalizeRouteMapData(aiData) : null), [aiData]);

    const requestAiCourse = async () => {
        setMode('ai');
        if (aiData || aiLoading) return; // 1회만 요청
        setAiLoading(true);
        setAiError(null);
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 120_000);
            const res = await fetch('/kride-api/recommend/itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    duration: '당일치기',
                    regions: ['서울'],
                    artists: [],
                    purposes: [],
                    budget: { min: 30000, max: 2000000 },
                }),
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`itinerary ${res.status}`);
            setAiData(await res.json());
        } catch {
            setAiError('AI 코스를 불러오지 못했어요. 기본 코스로 볼 수 있어요.');
        } finally {
            setAiLoading(false);
        }
    };

    const mapData = mode === 'ai' ? aiRouteData : tourData;

    return (
        <div className="page-wrap ROUTE_PLANNER route-screen" style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
            <header className="route-screen-header" style={{ padding: '14px 16px', borderBottom: '0.5px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#E50914' }}>동선</span>
                    <span style={{ fontSize: 13, color: '#888' }}>성지·맛집을 하루 코스로</span>
                </span>
                <span className="route-mode-toggle" style={{ display: 'flex', gap: 6 }}>
                    <button
                        type="button"
                        onClick={() => setMode('tour')}
                        aria-pressed={mode === 'tour'}
                        style={toggleStyle(mode === 'tour')}
                    >
                        기본 코스
                    </button>
                    <button
                        type="button"
                        onClick={requestAiCourse}
                        aria-pressed={mode === 'ai'}
                        style={toggleStyle(mode === 'ai')}
                    >
                        AI 코스
                    </button>
                </span>
            </header>

            {loading && <div style={{ padding: 24, color: '#888' }}>불러오는 중…</div>}
            {error && <div style={{ padding: 24, color: '#A32D2D' }}>{error}</div>}

            {mode === 'ai' && aiLoading && <div style={{ padding: 24, color: '#888' }}>AI가 하루 코스를 짜는 중이에요…</div>}
            {mode === 'ai' && aiError && <div style={{ padding: 24, color: '#A32D2D' }}>{aiError}</div>}

            {!loading && !error && mapData && !(mode === 'ai' && (aiLoading || aiError)) && (
                <div className="map-view w-full" style={{ flex: 1, minHeight: 400 }}>
                    <RouteMap data={mapData} />
                </div>
            )}
        </div>
    );
}

function toggleStyle(active: boolean): React.CSSProperties {
    return {
        fontSize: 13,
        padding: '6px 12px',
        borderRadius: 20,
        cursor: 'pointer',
        border: '0.5px solid ' + (active ? '#E50914' : '#ddd'),
        background: active ? '#E50914' : 'transparent',
        color: active ? '#fff' : '#555',
    };
}
