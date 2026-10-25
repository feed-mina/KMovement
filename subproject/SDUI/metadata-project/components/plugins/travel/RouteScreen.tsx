'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import {MotionButton} from '@/components/motion/KrideMotion';
import {ROUTE_MARKER_SELECT_EVENT, type RouteMapMarker} from '@/components/fields/kride/maps/mapTypes';
import RoadRoutePlanner from './RoadRoutePlanner';
import { type DirectionPlace, validDirectionPlace } from '@/lib/kride/directions';
import RouteMap from '@/components/fields/kride/maps/RouteMap';
import { tourPoisToRouteMapData } from '@/components/fields/kride/maps/tourToRouteMapData';
import { normalizeRouteMapData } from '@/components/fields/kride/maps/normalizeRouteMapData';
import { routeDistanceKm, estimateMinutes, formatMinutes, groupByDay, haversineKm } from '@/components/fields/kride/maps/routeSummary';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { fetchRestaurants, TourPoi } from '@/services/tourApi';
import KakaoShareButton from '@/components/fields/kride/KakaoShareButton';
import Skeleton from '@/components/utils/Skeleton';
import KrideStatePanel, { KrideStateChips } from '@/components/fields/kride/atoms/KrideStatePanel';
import { trackEvent } from '@/lib/analytics/dataLayer';
import { countItineraryPlaces } from '@/lib/analytics/itinerary';
import { buildItineraryRequest, validateItineraryRequest, itineraryHttpError, classifyItineraryError, itineraryErrorMessage } from '@/lib/kride/itineraryRequest';

// [동선] 화면 컨트롤러. 기본=TourAPI 최근접이웃 / AI=선호 기반 FastAPI 일정.
// Epic #74 · #77 · #85.
const REGIONS = ['서울', '부산', '제주'];
/** 기본 코스(TourAPI 맛집)가 쓰는 시·도 코드. TourExploreScreen 의 FALLBACK_AREAS 와 같은 체계다. */
const REGION_CODES: Record<string, string> = { 서울: '1', 부산: '6', 제주: '39' };
const PURPOSES = ['성지순례', '맛집투어', '자연·힐링'];
const DURATIONS = ['당일치기', '1박2일'];
const SLOT_LABEL: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁' };

/** 구간 이동 한 줄 (벤치마킹 H5): estimateMinutes 와 같은 15분/km 기준. 1.5km 까지는 도보로 적는다. */
export function legLabel(km: number): string {
    const rounded = Math.round(km * 10) / 10;
    const minutes = Math.max(1, Math.round(km * 15));
    return `다음까지 ${rounded}km · ${km <= 1.5 ? '도보' : '이동'} 약 ${minutes}분`;
}

export default function RouteScreen(_props: ScreenControllerProps) {
    const [selectedStopId, setSelectedStopId] = useState<string>();
    const [roadDestination, setRoadDestination] = useState<DirectionPlace>();
    const [roadReturnMode, setRoadReturnMode] = useState<'tour' | 'ai'>('tour');
    const roadHeading = useRef<HTMLHeadingElement>(null);
    const selectStop = useCallback((marker: RouteMapMarker) => setSelectedStopId(marker.id), []);
    const { isLoggedIn } = useAuth();
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tourAttempt, setTourAttempt] = useState(0);

    const [mode, setMode] = useState<'tour' | 'ai' | 'road'>('tour');
    const [region, setRegion] = useState('서울');
    const [purpose, setPurpose] = useState('성지순례');
    const [duration, setDuration] = useState('당일치기');
    const [aiSources, setAiSources] = useState<{id:string;name:string;sourceUrl:string;verifiedAt:string}[]>([]);
    const [budgetMin,setBudgetMin] = useState(30000);
    const [budgetMax,setBudgetMax] = useState(2000000);
    const [visitDate, setVisitDate] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [responseLocale, setResponseLocale] = useState<'ko' | 'en' | 'ja'>('ko');
    const inFlightRef = useRef(false);
    const [aiScope, setAiScope] = useState('');
    const [aiData, setAiData] = useState<unknown | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiErrorKind, setAiErrorKind] = useState<import('@/lib/kride/itineraryRequest').ItineraryErrorKind | null>(null);
    const fetchedKeyRef = useRef<string>('');
    const [openDays, setOpenDays] = useState<Record<number, boolean>>({ 1: true });

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        // 기본 코스도 고른 지역을 쓴다 (벤치마킹 H5: 조건 → 결과). 목적·기간은 AI 추천에서만 반영된다.
        fetchRestaurants({ areaCode: REGION_CODES[region] ?? '1', numOfRows: 12, pageNo: 1 })
            .then((list) => { if (alive) setPois(list); })
            .catch(() => { if (alive) setError('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [tourAttempt, region]);

    const tourData = useMemo(() => tourPoisToRouteMapData(pois), [pois]);
    const aiRouteData = useMemo(() => (aiData ? normalizeRouteMapData(aiData) : null), [aiData]);
    const mapData = mode === 'ai' ? aiRouteData : tourData;
    const markers = useMemo(() => mapData?.markers ?? [], [mapData]);
    const dayGroups = useMemo(() => groupByDay(markers), [markers]);
    const directionsMarkers = (roadReturnMode === 'ai' && mode === 'road' ? aiRouteData : mapData)?.markers ?? [];
    const destinations = directionsMarkers.map(m => ({ id: m.id, name: m.name, address: m.address, lat: m.lat, lon: m.lng })).filter(validDirectionPlace);
    const openDirections = (destination?: DirectionPlace) => {
        if (mode === 'road') return;
        setRoadReturnMode(mode);
        setRoadDestination(destination ?? destinations.find(place => place.id === selectedStopId));
        setMode('road');
    };
    useEffect(() => { if (mode === 'road') roadHeading.current?.focus(); }, [mode]);
    const unsupportedAi = region !== '서울' || duration !== '당일치기';

    const fetchAi = async () => {
        setAiData(null);setAiSources([]);setAiScope('');
        let body;
        try {
            body = buildItineraryRequest({ duration, regions: [region], purposes: [purpose], artists: [], visitDate, budget:{min:budgetMin,max:budgetMax}, responseLocale, acknowledgeUnverifiedConditions: acknowledged });
            validateItineraryRequest(body);
        } catch (reason) {
            setAiErrorKind(classifyItineraryError(reason));
            setAiError(itineraryErrorMessage(reason));
            return;
        }
        const key = JSON.stringify(body);
        if (fetchedKeyRef.current === key) return; // 같은 조건이면 재요청 안 함
        if (inFlightRef.current) return;
        inFlightRef.current = true;
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
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!res.ok) throw itineraryHttpError(res.status, await res.json().catch(() => ({})));
            const result = await res.json();
            setAiScope(result.scopeNotice ?? '');
            if (result.status === 'empty_candidates') throw new Error('empty_candidates');
            const placeCount = countItineraryPlaces(result);
            if (placeCount === 0) throw new Error('empty_result');
            fetchedKeyRef.current = key;
            setAiData(result);
            setAiSources(Array.isArray(result.source_pois) ? result.source_pois : []);
            trackEvent('itinerary_generated', { place_count: placeCount, duration, source: 'route_planner' });
        } catch (reason) {
            setAiErrorKind(classifyItineraryError(reason));
            setAiError(itineraryErrorMessage(reason));
            trackEvent('itinerary_error', {
                error_type: classifyItineraryError(reason),
                source: 'route_planner',
            });
        } finally {
            if (timer) clearTimeout(timer);
            inFlightRef.current = false;
            setAiLoading(false);
        }
    };

    const requestAiCourse = () => {
        trackEvent('itinerary_start', { entry_point: 'route_planner_ai_button' });
        setMode('ai');
    };
    // 실패 후 같은 조건으로 다시 요청 (입력값 보존)
    const retryAi = () => { fetchedKeyRef.current = ''; void fetchAi(); };
    // AI 모드에서 선호를 바꾸면 재추천
    const changePref = (setter: (v: string) => void, v: string) => {
        setter(v);
        setSelectedStopId(undefined);
        if (setter === setRegion) setPois([]);
        if (mode === 'ai') { fetchedKeyRef.current = ''; setAiData(null); setAiError(null); }
    };


    return (
        <div className="page-wrap ROUTE_PLANNER route-screen">
            <header className="route-screen__header">
                <span className="route-screen__heading">
                    <span className="route-screen__title">하루 코스 만들기</span>
                    <span className="route-screen__subtitle">조건을 고르면 지도와 순서를 바로 받아요</span>
                </span>
            </header>

            {mode === 'road' ? (
                <>
                    <div className="route-road-head">
                        <h2 className="route-road-head__title" ref={roadHeading} tabIndex={-1}>{region} 길찾기</h2>
                        <MotionButton type="button" className="route-pill" onClick={() => setMode(roadReturnMode)}>코스로 돌아가기</MotionButton>
                    </div>
                    <RoadRoutePlanner region={region} destinations={destinations} initialDestination={roadDestination} />
                </>
            ) : (
                <div className="route-prefs">
                    <div className="route-prefs__row">
                        <span className="route-prefs__label">지역</span>
                        <div className="route-prefs__chips" role="group" aria-label="지역">
                            {REGIONS.map((r) => <MotionButton key={r} type="button" disabled={aiLoading} onClick={() => changePref(setRegion, r)} aria-pressed={region === r} className="route-chip">{r}</MotionButton>)}
                        </div>
                    </div>
                    <div className="route-prefs__row">
                        <span className="route-prefs__label">목적</span>
                        <div className="route-prefs__chips" role="group" aria-label="목적">
                            {PURPOSES.map((p) => <MotionButton key={p} type="button" disabled={aiLoading} onClick={() => changePref(setPurpose, p)} aria-pressed={purpose === p} className="route-chip">{p}</MotionButton>)}
                        </div>
                    </div>
                    <div className="route-prefs__row">
                        <span className="route-prefs__label">기간</span>
                        <div className="route-prefs__chips" role="group" aria-label="기간">
                            {DURATIONS.map((d) => <MotionButton key={d} type="button" disabled={aiLoading} onClick={() => changePref(setDuration, d)} aria-pressed={duration === d} className="route-chip">{d}</MotionButton>)}
                        </div>
                    </div>
                    <div className="route-prefs__foot">
                        <div className="route-seg" role="group" aria-label="코스 방식">
                            <MotionButton type="button" onClick={() => setMode('tour')} aria-pressed={mode === 'tour'} className="route-seg__btn"><span>기본 코스</span></MotionButton>
                            <MotionButton type="button" onClick={requestAiCourse} aria-pressed={mode === 'ai'} className="route-seg__btn"><span>AI 코스</span>{!isLoggedIn && <span className="route-seg__badge">로그인</span>}</MotionButton>
                        </div>
                        <p className="route-prefs__hint">{mode === 'ai' ? '조건을 확인한 뒤 코스 만들기를 눌러 주세요' : '기본 코스는 고른 지역의 맛집을 가까운 순으로 이어요 · 목적·기간은 AI 코스에 반영'}</p>
                    </div>
                    {mode === 'ai' && <section aria-label="AI 코스 안내">
                    <p>현재 서울 당일치기만 지원합니다. 휴무일·영업시간·1인 장소 방문비를 검사합니다. 교통·숙박비는 별도이며 예약 가능 여부는 검사하지 않습니다.</p>
                    <p>예산은 1인 장소 방문비 합계입니다. 교통·숙박비는 별도입니다.</p>
                    <label>최소 방문비(원) <input type="number" min="0" max="100000000" value={budgetMin} disabled={aiLoading} onChange={e=>{setBudgetMin(Number(e.target.value));setAiData(null);fetchedKeyRef.current='';}}/></label>
                    <label>최대 방문비(원) <input type="number" min="0" max="100000000" value={budgetMax} disabled={aiLoading} onChange={e=>{setBudgetMax(Number(e.target.value));setAiData(null);fetchedKeyRef.current='';}}/></label>
                    <label>방문 날짜 <input type="date" value={visitDate} disabled={aiLoading} onChange={e=>{setVisitDate(e.target.value);setAiData(null);fetchedKeyRef.current='';}}/></label>
                    <label>안내 언어 <select value={responseLocale} disabled={aiLoading} onChange={e => { setResponseLocale(e.target.value as 'ko' | 'en' | 'ja'); setAiData(null); setAiError(null); fetchedKeyRef.current = ''; }}><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option></select></label>
                    <p><label><input type="checkbox" checked={acknowledged} disabled={aiLoading} onChange={e => { setAcknowledged(e.target.checked); setAiData(null); setAiError(null); fetchedKeyRef.current = ''; }} /> 아티스트 후보가 없을 때 일반 장소 코스로 전환하는 데 동의합니다. 시간·방문비 조건은 유지합니다.</label></p>
                    {!acknowledged && <p role="status">일반 코스 전환 동의는 선택 사항입니다. 아티스트를 고르지 않은 이 화면에서는 시간·방문비 조건으로 코스를 만듭니다.</p>}
                    {unsupportedAi && <div className="route-ai-scope" role="status">
                        <p>{region} · {duration} AI 코스는 아직 준비 중이에요. 고른 지역의 기본 코스와 길찾기는 이용할 수 있어요.</p>
                        <MotionButton type="button" className="route-pill" onClick={() => setMode('tour')}>{region} 기본 코스 보기</MotionButton>
                        <MotionButton type="button" className="route-pill" onClick={() => { setRegion('서울'); setDuration('당일치기'); if (region !== '서울') setPois([]); setSelectedStopId(undefined); setAiData(null); setAiError(null); fetchedKeyRef.current = ''; }}>서울 당일치기로 바꾸기</MotionButton>
                    </div>}
                    <MotionButton type="button" disabled={!visitDate || aiLoading || unsupportedAi} onClick={() => void fetchAi()}>코스 만들기</MotionButton>
                    </section>}
                </div>
            )}

            {mode === 'ai' && aiScope && <p role="status">{aiScope}</p>}
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
                    kind={aiErrorKind === 'login' ? 'forbidden' : aiErrorKind === 'candidates' || aiErrorKind === 'no-route' ? 'empty-first' : 'error'}
                    title={aiErrorKind === 'login' ? '로그인 후 AI 코스를 받을 수 있어요' : aiErrorKind === 'candidates' || aiErrorKind === 'no-route' ? '추천 자료가 아직 없어요' : 'AI 코스를 불러오지 못했어요'}
                    description={aiError}
                    context={<KrideStateChips label="고른 조건" items={[{ text: region, accent: true }, { text: purpose }, { text: duration }]} />}
                    primaryAction={aiErrorKind === 'login'
                        ? { label: '로그인하기', href: '/view/LOGIN_PAGE?returnTo=' + encodeURIComponent('/view/ROUTE_PLANNER') }
                        : aiErrorKind === 'candidates' || aiErrorKind === 'no-route'
                            ? { label: '기본 코스 보기', onClick: () => setMode('tour') }
                            : ['consent', 'unsupported', 'validation', 'forbidden'].includes(aiErrorKind ?? '')
                            ? { label: '조건 확인하기', onClick: () => setAiError(null) }
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
                        <div className="route-result-map">
                            <RouteMap data={mapData} onSelect={selectStop} />
                        </div>
                    )}

                    {markers.length > 0 && (
                        <div className="route-days">
                            {dayGroups.map((g) => {
                                const open = openDays[g.day] ?? true;
                                return (
                                    <div key={g.day} className="route-day">
                                        <MotionButton
                                            type="button"
                                            onClick={() => setOpenDays((p) => ({ ...p, [g.day]: !open }))}
                                            aria-expanded={open}
                                            className="route-day__toggle"
                                        >
                                            <span className="route-day__title">Day {g.day} · {g.markers.length}곳</span>
                                            <span className="route-day__caret" aria-hidden="true">{open ? '▲' : '▼'}</span>
                                        </MotionButton>
                                        {open && (
                                            <div className="route-day__list">
                                                {g.markers.map((m, stopIndex) => {
                                                    const next = g.markers[stopIndex + 1];
                                                    return (
                                                        <div key={m.id} className="route-stop" data-selected={selectedStopId === m.id} style={{animationDelay: `${stopIndex < 6 ? stopIndex * 40 : 0}ms`}}>
                                                            <span className="route-stop__index">{m.index + 1}</span>
                                                            <div className="route-stop__body">
                                                                <MotionButton type="button" className="route-stop__name" aria-label={`${m.name} 지도에서 선택`} aria-pressed={selectedStopId === m.id}
                                                                    onClick={() => window.dispatchEvent(new CustomEvent(ROUTE_MARKER_SELECT_EVENT, {detail: {id: m.id}}))}>{m.name}</MotionButton>
                                                                <p className="route-stop__meta">
                                                                    {[m.slot ? (SLOT_LABEL[m.slot] ?? m.slot) : null, m.address].filter(Boolean).join(' · ')}
                                                                </p>
                                                                <MotionButton type="button" className="route-stop__directions" aria-label={m.name + ' 길찾기'}
                                                                    onClick={() => openDirections({id: m.id, name: m.name, address: m.address, lat: m.lat, lon: m.lng})}>여기로 길찾기</MotionButton>
                                                                {next && <p className="route-stop__leg">↓ {legLabel(haversineKm(m, next))}</p>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {mode !== 'road' && (
                <div className="route-actions">
                    <MotionButton type="button" className="route-pill" onClick={() => openDirections()}>길 찾기</MotionButton>
                    <KakaoShareButton text="Kride에서 추천받은 하루 코스를 확인해 보세요!" path="/view/ROUTE_PLANNER" />
                    <Link className="route-pill route-actions__link" href="/view/SET_TIME_PAGE">약속 시간</Link>
                </div>
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
