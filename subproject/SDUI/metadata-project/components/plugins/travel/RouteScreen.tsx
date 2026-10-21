'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import RoadRoutePlanner from './RoadRoutePlanner';
import RouteMap from '@/components/fields/kride/maps/RouteMap';
import { tourPoisToRouteMapData } from '@/components/fields/kride/maps/tourToRouteMapData';
import { normalizeRouteMapData } from '@/components/fields/kride/maps/normalizeRouteMapData';
import { routeDistanceKm, estimateMinutes, formatMinutes, groupByDay } from '@/components/fields/kride/maps/routeSummary';
import { fetchRestaurants, TourPoi } from '@/services/tourApi';
import KakaoShareButton from '@/components/fields/kride/KakaoShareButton';
import Skeleton from '@/components/utils/Skeleton';
import KrideStatePanel, { KrideStateChips } from '@/components/fields/kride/atoms/KrideStatePanel';
import { trackEvent } from '@/lib/analytics/dataLayer';
import { countItineraryPlaces } from '@/lib/analytics/itinerary';

// [동선] 화면 컨트롤러. 기본=TourAPI 최근접이웃 / AI=선호 기반 FastAPI 일정.
// Epic #74 · #77 · #85.
const REGIONS = ['서울', '부산', '제주'];
const PURPOSES = ['성지순례', '맛집투어', '자연·힐링'];
const DURATIONS = ['당일치기', '1박2일'];
const SLOT_LABEL: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁' };

export default function RouteScreen(_props: ScreenControllerProps) {
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tourAttempt, setTourAttempt] = useState(0);

    const [mode, setMode] = useState<'tour' | 'ai' | 'road'>('tour');
    const [region, setRegion] = useState('서울');
    const [purpose, setPurpose] = useState('성지순례');
    const [duration, setDuration] = useState('당일치기');
    const [aiSources, setAiSources] = useState<{id:string;name:string;sourceUrl:string;verifiedAt:string}[]>([]);
    const [aiData, setAiData] = useState<unknown | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiErrorKind, setAiErrorKind] = useState<'login' | 'empty' | 'server' | null>(null);
    const fetchedKeyRef = useRef<string>('');
    const [openDays, setOpenDays] = useState<Record<number, boolean>>({ 1: true });

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        fetchRestaurants({ areaCode: '1', numOfRows: 12, pageNo: 1 })
            .then((list) => { if (alive) setPois(list); })
            .catch(() => { if (alive) setError('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [tourAttempt]);

    const tourData = useMemo(() => tourPoisToRouteMapData(pois), [pois]);
    const aiRouteData = useMemo(() => (aiData ? normalizeRouteMapData(aiData) : null), [aiData]);
    const mapData = mode === 'ai' ? aiRouteData : tourData;
    const markers = useMemo(() => mapData?.markers ?? [], [mapData]);
    const dayGroups = useMemo(() => groupByDay(markers), [markers]);

    const fetchAi = async () => {
        const key = JSON.stringify({ region, purpose, duration });
        if (fetchedKeyRef.current === key) return; // 같은 조건이면 재요청 안 함
        if (aiLoading) return;
        setAiLoading(true);
        setAiData(null);
        setAiSources([]);
        setAiError(null);
        setAiErrorKind(null);
        trackEvent('preferences_complete', { region, purpose, duration });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const controller = new AbortController();
            timer = setTimeout(() => controller.abort(), 120_000);
            const res = await fetch('/api/kride/recommend/itinerary', {
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
            if (res.status === 401) throw new Error('login_required');
            if (!res.ok) throw new Error(`itinerary ${res.status}`);
            const result = await res.json();
            if (result.status === 'empty_candidates') throw new Error('empty_candidates');
            fetchedKeyRef.current = key;
            const placeCount = countItineraryPlaces(result);
            if (placeCount === 0) throw new Error('empty_result');
            setAiData(result);
            setAiSources(Array.isArray(result.source_pois) ? result.source_pois : []);
            trackEvent('itinerary_generated', { place_count: placeCount, duration, source: 'route_planner' });
        } catch (reason) {
            const code = reason instanceof Error ? reason.message : '';
            const kind = code === 'login_required' ? 'login' : code === 'empty_candidates' ? 'empty' : 'server';
            setAiErrorKind(kind);
            setAiError(kind === 'login' ? '로그인 후 AI 코스를 이용해 주세요.' : kind === 'empty' ? '출처가 확인된 추천 자료가 아직 없습니다.' : 'AI 코스를 불러오지 못했어요. 기본 코스로 볼 수 있어요.');
            const message = reason instanceof Error ? reason.message : 'unknown';
            trackEvent('itinerary_error', {
                error_type: message === 'empty_result' ? 'empty_result' : message.includes('aborted') ? 'timeout' : message.startsWith('itinerary ') ? 'http_error' : 'request_error',
                source: 'route_planner',
            });
        } finally {
            if (timer) clearTimeout(timer);
            setAiLoading(false);
        }
    };

    const requestAiCourse = () => {
        trackEvent('itinerary_start', { entry_point: 'route_planner_ai_button' });
        setMode('ai');
        void fetchAi();
    };
    // 실패 후 같은 조건으로 다시 요청 (입력값 보존)
    const retryAi = () => { fetchedKeyRef.current = ''; void fetchAi(); };
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
        <div className="page-wrap ROUTE_PLANNER route-screen">
            <header className="route-screen__header">
                <span className="route-screen__heading">
                    <span className="route-screen__title">동선</span>
                    <span className="route-screen__subtitle">내 취향대로 하루 코스</span>
                </span>
                <span className="route-screen__modes">
                    <button type="button" onClick={() => setMode('road')} aria-pressed={mode === 'road'} className="route-pill">길 찾기</button>
                    <KakaoShareButton text="Kride에서 추천받은 하루 코스를 확인해 보세요!" path="/view/ROUTE_PLANNER" />
                    <button type="button" onClick={() => setMode('tour')} aria-pressed={mode === 'tour'} className="route-pill">기본 코스</button>
                    <button type="button" onClick={requestAiCourse} aria-pressed={mode === 'ai'} className="route-pill">AI 코스</button>
                </span>
            </header>

            {mode === 'road' && <RoadRoutePlanner />}
            {mode === 'ai' && (
                <div className="route-prefs">
                    <div className="route-prefs__hint">이 조건으로 코스를 짜요 · 바꾸면 다시 추천</div>
                    <div className="route-prefs__chips">
                        {REGIONS.map((r) => <button key={r} type="button" onClick={() => changePref(setRegion, r)} aria-pressed={region === r} className="route-chip">{r}</button>)}
                        <span className="route-prefs__divider" />
                        {PURPOSES.map((p) => <button key={p} type="button" onClick={() => changePref(setPurpose, p)} aria-pressed={purpose === p} className="route-chip">{p}</button>)}
                        <span className="route-prefs__divider" />
                        {DURATIONS.map((d) => <button key={d} type="button" onClick={() => changePref(setDuration, d)} aria-pressed={duration === d} className="route-chip">{d}</button>)}
                    </div>
                </div>
            )}

            {mode === 'tour' && loading && <RouteSkeleton label="기본 코스를 불러오는 중" />}
            {mode === 'tour' && error && (
                <KrideStatePanel
                    kind="error"
                    title="장소를 불러오지 못했어요"
                    description={error}
                    primaryAction={{ label: '다시 시도', onClick: () => setTourAttempt((n) => n + 1) }}
                />
            )}
            {mode === 'ai' && aiLoading && <RouteSkeleton label="AI가 하루 코스를 짜는 중이에요" note="AI가 하루 코스를 짜는 중이에요… 최대 2분 정도 걸릴 수 있고, 고른 조건은 그대로예요." />}
            {mode === 'ai' && aiError && (
                <KrideStatePanel
                    kind={aiErrorKind === 'login' ? 'forbidden' : aiErrorKind === 'empty' ? 'empty-first' : 'error'}
                    title={aiErrorKind === 'login' ? '로그인 후 AI 코스를 받을 수 있어요' : aiErrorKind === 'empty' ? '추천 자료가 아직 없어요' : 'AI 코스를 불러오지 못했어요'}
                    description={aiError}
                    context={<KrideStateChips label="고른 조건" items={[{ text: region, accent: true }, { text: purpose }, { text: duration }]} />}
                    primaryAction={aiErrorKind === 'login'
                        ? { label: '로그인하기', href: '/view/LOGIN_PAGE?returnTo=' + encodeURIComponent('/view/ROUTE_PLANNER') }
                        : aiErrorKind === 'empty'
                            ? { label: '기본 코스 보기', onClick: () => setMode('tour') }
                            : { label: '다시 시도', onClick: retryAi }}
                    secondaryAction={aiErrorKind === 'server' ? { label: '기본 코스 보기', onClick: () => setMode('tour') } : undefined}
                />
            )}

            {mode !== 'road' && (mode === 'ai' || (!loading && !error)) && !(mode === 'ai' && (aiLoading || aiError)) && (
                <>
                    {mode === 'ai' && aiSources.length > 0 && <details><summary>추천 자료 출처와 확인 시각</summary><p>공개 장소 근거 · 영업시간과 여행 지출은 별도 확인이 필요합니다.</p><ul>{aiSources.map(p => <li key={p.id}><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.name}</a> · 확인 {p.verifiedAt}</li>)}</ul></details>}
                    {markers.length > 0 && (
                        <div className="route-summary">
                            <SummaryCard value={String(markers.length)} label="방문지" accent />
                            <SummaryCard value={formatMinutes(estimateMinutes(markers))} label="예상 소요" />
                            <SummaryCard value={`${routeDistanceKm(markers)}km`} label="이동 거리" />
                        </div>
                    )}

                    {mapData && (
                        <div className="map-view w-full route-map">
                            <RouteMap data={mapData} />
                        </div>
                    )}

                    {markers.length > 0 && (
                        <div className="route-days">
                            {dayGroups.map((g) => {
                                const open = openDays[g.day] ?? true;
                                return (
                                    <div key={g.day} className="route-day">
                                        <button
                                            type="button"
                                            onClick={() => setOpenDays((p) => ({ ...p, [g.day]: !open }))}
                                            aria-expanded={open}
                                            className="route-day__toggle"
                                        >
                                            <span className="route-day__title">Day {g.day} · {g.markers.length}곳</span>
                                            <span className="route-day__caret" aria-hidden="true">{open ? '▲' : '▼'}</span>
                                        </button>
                                        {open && (
                                            <div className="route-day__list">
                                                {g.markers.map((m) => (
                                                    <div key={m.id} className="route-stop">
                                                        <span className="route-stop__index">{m.index + 1}</span>
                                                        <div className="route-stop__body">
                                                            <p className="route-stop__name">{m.name}</p>
                                                            <p className="route-stop__meta">
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

function RouteSkeleton({ label, note }: { label: string; note?: string }) {
    return (
        <div className="route-skeleton" role="status" aria-live="polite" aria-label={label}>
            {note && <p className="route-skeleton__note">{note}</p>}
            <div className="route-summary"><Skeleton height={54} /><Skeleton height={54} /><Skeleton height={54} /></div>
            <Skeleton height={240} />
            <Skeleton height={44} />
            <Skeleton height={44} />
        </div>
    );
}

function SummaryCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
    return (
        <div className="route-summary__card">
            <div className={`route-summary__value${accent ? ' route-summary__value--accent' : ''}`}>{value}</div>
            <div className="route-summary__label">{label}</div>
        </div>
    );
}
