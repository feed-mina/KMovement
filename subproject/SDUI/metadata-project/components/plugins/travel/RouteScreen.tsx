'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import RouteMap from '@/components/fields/kride/maps/RouteMap';
import { tourPoisToRouteMapData } from '@/components/fields/kride/maps/tourToRouteMapData';
import { normalizeRouteMapData } from '@/components/fields/kride/maps/normalizeRouteMapData';
import { routeDistanceKm, estimateMinutes, formatMinutes, groupByDay } from '@/components/fields/kride/maps/routeSummary';
import { fetchRestaurants, TourPoi } from '@/services/tourApi';

// [동선] 화면 컨트롤러. 기본=TourAPI 최근접이웃 / AI=선호 기반 FastAPI 일정.
// Epic #74 · #77 · #85.
const RED = '#E50914';
const REGIONS = ['서울', '부산', '제주'];
const PURPOSES = ['성지순례', '맛집투어', '자연·힐링'];
const DURATIONS = ['당일치기', '1박2일'];
const SLOT_LABEL: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁' };

export default function RouteScreen(_props: ScreenControllerProps) {
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [mode, setMode] = useState<'tour' | 'ai'>('tour');
    const [region, setRegion] = useState('서울');
    const [purpose, setPurpose] = useState('성지순례');
    const [duration, setDuration] = useState('당일치기');
    const [aiData, setAiData] = useState<unknown | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const fetchedKeyRef = useRef<string>('');
    const [openDays, setOpenDays] = useState<Record<number, boolean>>({ 1: true });

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
    const mapData = mode === 'ai' ? aiRouteData : tourData;
    const markers = mapData?.markers ?? [];
    const dayGroups = useMemo(() => groupByDay(markers), [markers]);

    const fetchAi = async () => {
        const key = JSON.stringify({ region, purpose, duration });
        if (fetchedKeyRef.current === key && aiData) return; // 같은 조건이면 재요청 안 함
        setAiLoading(true);
        setAiError(null);
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 120_000);
            const res = await fetch('/kride-api/recommend/itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    duration,
                    regions: [region],
                    purposes: [purpose],
                    artists: [],
                    budget: { min: 30000, max: 2000000 },
                }),
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`itinerary ${res.status}`);
            setAiData(await res.json());
            fetchedKeyRef.current = key;
        } catch {
            setAiError('AI 코스를 불러오지 못했어요. 기본 코스로 볼 수 있어요.');
        } finally {
            setAiLoading(false);
        }
    };

    const requestAiCourse = () => { setMode('ai'); void fetchAi(); };
    // AI 모드에서 선호를 바꾸면 재추천
    const changePref = (setter: (v: string) => void, v: string) => {
        setter(v);
        if (mode === 'ai') { fetchedKeyRef.current = ''; }
    };
    useEffect(() => {
        if (mode === 'ai') void fetchAi();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [region, purpose, duration]);

    return (
        <div className="page-wrap ROUTE_PLANNER route-screen" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: RED }}>동선</span>
                    <span style={{ fontSize: 13, color: '#888' }}>내 취향대로 하루 코스</span>
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => setMode('tour')} aria-pressed={mode === 'tour'} style={pill(mode === 'tour')}>기본 코스</button>
                    <button type="button" onClick={requestAiCourse} aria-pressed={mode === 'ai'} style={pill(mode === 'ai')}>AI 코스</button>
                </span>
            </header>

            {mode === 'ai' && (
                <div style={{ background: '#faf7f8', border: '0.5px solid #eee', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>이 조건으로 코스를 짜요 · 바꾸면 다시 추천</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {REGIONS.map((r) => <button key={r} type="button" onClick={() => changePref(setRegion, r)} aria-pressed={region === r} style={miniChip(region === r)}>{r}</button>)}
                        <span style={{ width: 1, background: '#eee', margin: '0 2px' }} />
                        {PURPOSES.map((p) => <button key={p} type="button" onClick={() => changePref(setPurpose, p)} aria-pressed={purpose === p} style={miniChip(purpose === p)}>{p}</button>)}
                        <span style={{ width: 1, background: '#eee', margin: '0 2px' }} />
                        {DURATIONS.map((d) => <button key={d} type="button" onClick={() => changePref(setDuration, d)} aria-pressed={duration === d} style={miniChip(duration === d)}>{d}</button>)}
                    </div>
                </div>
            )}

            {loading && <div style={{ padding: 24, color: '#888' }}>불러오는 중…</div>}
            {error && <div style={{ padding: 24, color: '#A32D2D' }}>{error}</div>}
            {mode === 'ai' && aiLoading && <div style={{ padding: 24, color: '#888' }}>AI가 하루 코스를 짜는 중이에요…</div>}
            {mode === 'ai' && aiError && <div style={{ padding: 24, color: '#A32D2D' }}>{aiError}</div>}

            {!loading && !error && !(mode === 'ai' && (aiLoading || aiError)) && (
                <>
                    {markers.length > 0 && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <SummaryCard value={String(markers.length)} label="방문지" accent />
                            <SummaryCard value={formatMinutes(estimateMinutes(markers))} label="예상 소요" />
                            <SummaryCard value={`${routeDistanceKm(markers)}km`} label="이동 거리" />
                        </div>
                    )}

                    {mapData && (
                        <div className="map-view w-full" style={{ minHeight: 360, borderRadius: 12, overflow: 'hidden' }}>
                            <RouteMap data={mapData} />
                        </div>
                    )}

                    {markers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {dayGroups.map((g) => {
                                const open = openDays[g.day] ?? true;
                                return (
                                    <div key={g.day} style={{ border: '0.5px solid #eee', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenDays((p) => ({ ...p, [g.day]: !open }))}
                                            aria-expanded={open}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', background: '#faf7f8', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                                        >
                                            <span style={{ color: RED }}>Day {g.day} · {g.markers.length}곳</span>
                                            <span style={{ color: '#bbb' }}>{open ? '▲' : '▼'}</span>
                                        </button>
                                        {open && (
                                            <div style={{ padding: '2px 12px' }}>
                                                {g.markers.map((m, idx) => (
                                                    <div key={m.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: idx < g.markers.length - 1 ? '0.5px solid #f0f0f0' : 'none' }}>
                                                        <span style={{ width: 22, height: 22, flex: 'none', borderRadius: '50%', background: RED, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.index + 1}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{m.name}</p>
                                                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>
                                                                {[m.slot ? (SLOT_LABEL[m.slot] ?? m.slot) : null, m.address].filter(Boolean).join(' · ')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function SummaryCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
    return (
        <div style={{ flex: 1, background: '#f7f7f8', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: accent ? RED : '#333' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
        </div>
    );
}

function pill(active: boolean): React.CSSProperties {
    return { fontSize: 12, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', border: '0.5px solid ' + (active ? RED : '#ddd'), background: active ? RED : 'transparent', color: active ? '#fff' : '#555' };
}
function miniChip(active: boolean): React.CSSProperties {
    return { fontSize: 12, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', border: '0.5px solid ' + (active ? RED : '#ddd'), background: active ? '#FCEBEB' : 'transparent', color: active ? '#A32D2D' : '#666', fontWeight: active ? 500 : 400 };
}
