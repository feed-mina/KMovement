'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ScreenControllerProps } from '@/components/screens/types';
import {
    fetchHolyContents,
    fetchHolyPois,
    fetchTourAreas,
    fetchTourDistricts,
    fetchTourPois,
    HolyContentOption,
    TourPoi,
    TourRegion,
} from '@/services/tourApi';
import { HOLY_SITES } from '@/lib/data/holySites';
import KakaoShareButton from '@/components/fields/kride/KakaoShareButton';
import PoiImage from '@/components/plugins/travel/PoiImage';
import TourPoiCard from '@/components/plugins/travel/TourPoiCard';
import { trackEvent } from '@/lib/analytics/dataLayer';

// [탐색] 화면 컨트롤러 (여행 플러그인). TourAPI POI를 지역·카테고리·정렬로 탐색.
// Epic #74 · #85 · 성지 #78.

const CATEGORIES = [
    { id: 'HOLY', label: '성지' },
    // 성지 맛집(V92): 방영 씬 설명이 있는 식당·카페 촬영지 부분집합.
    // 일반 '맛집'(TourAPI 실시간)과 다른 큐레이션이다.
    { id: 'HOLY_FOOD', label: '성지 맛집' },
    { id: '39', label: '맛집' },
    { id: '12', label: '관광지' },
    { id: '14', label: '문화시설' },
] as const;

/** 성지 계열(공용 tour_poi 데이터) 카테고리 여부 — 작품 필터를 공유한다. */
const isHolyCategory = (category: string) => category === 'HOLY' || category === 'HOLY_FOOD';

/** 한 번에 그리는 카드 수. TourAPI 조회의 numOfRows(24)와 맞춘다. */
const PAGE_SIZE = 24;
/** lazy 를 끄고 우선순위를 올릴 카드 수 — 첫 화면에 실제로 보이는 만큼만. */
const EAGER_CARD_COUNT = 6;

// 서버(TourService.NATIONWIDE_AREAS)와 동일한 TourAPI 시/도 코드 체계.
// /areas 응답 실패 시에도 전국 성지(V90 시드)를 탐색할 수 있어야 한다.
const FALLBACK_AREAS: TourRegion[] = [
    { code: '1', name: '서울' }, { code: '2', name: '인천' },
    { code: '3', name: '대전' }, { code: '4', name: '대구' },
    { code: '5', name: '광주' }, { code: '6', name: '부산' },
    { code: '7', name: '울산' }, { code: '8', name: '세종' },
    { code: '31', name: '경기' }, { code: '32', name: '강원' },
    { code: '33', name: '충북' }, { code: '34', name: '충남' },
    { code: '35', name: '경북' }, { code: '36', name: '경남' },
    { code: '37', name: '전북' }, { code: '38', name: '전남' },
    { code: '39', name: '제주' },
];
const FALLBACK_SEOUL_DISTRICTS: TourRegion[] = [
    { code: '1', name: '강남구' }, { code: '2', name: '강동구' },
    { code: '3', name: '강북구' }, { code: '4', name: '강서구' },
    { code: '5', name: '관악구' }, { code: '6', name: '광진구' },
    { code: '7', name: '구로구' }, { code: '8', name: '금천구' },
    { code: '9', name: '노원구' }, { code: '10', name: '도봉구' },
    { code: '11', name: '동대문구' }, { code: '12', name: '동작구' },
    { code: '13', name: '마포구' }, { code: '14', name: '서대문구' },
    { code: '15', name: '서초구' }, { code: '16', name: '성동구' },
    { code: '17', name: '성북구' }, { code: '18', name: '송파구' },
    { code: '19', name: '양천구' }, { code: '20', name: '영등포구' },
    { code: '21', name: '용산구' }, { code: '22', name: '은평구' },
    { code: '23', name: '종로구' }, { code: '24', name: '중구' },
    { code: '25', name: '중랑구' },
];

const DEFAULT_AREA_CODE = '1';

/**
 * ?area= 로 들어온 시·도 코드를 검증한다.
 * 맛집 랜딩(/travel/food/{area})에서 지역을 물고 넘어올 때 쓴다.
 * 모르는 값·빈 값은 기본 지역으로 둔다 — 잘못된 코드로 빈 목록을 보여주지 않기 위해서다.
 */
export function resolveAreaParam(value?: string | null): string {
    const code = value?.trim();
    if (!code) return DEFAULT_AREA_CODE;
    return FALLBACK_AREAS.some((area) => area.code === code) ? code : DEFAULT_AREA_CODE;
}

const SORTS = [
    { code: 'A', label: '이름순' },
    { code: 'C', label: '최신순' },
] as const;

const CONTENT_CATEGORY_LABELS: Record<string, string> = {
    kpop: 'K-POP', drama: '드라마', movie: '영화', show: '예능',
};

const SAVED_KEY = 'kride:saved-pois';

function safeExternalUrl(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
    } catch {
        return undefined;
    }
}

const RED = '#E50914';

function HorizontalFilterRail({
    label,
    busy,
    children,
}: {
    label: string;
    busy?: boolean;
    children: React.ReactNode;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({ left: false, right: false });

    const updateScrollState = useCallback(() => {
        const rail = scrollRef.current;
        if (!rail) return;
        const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
        setScrollState({
            left: rail.scrollLeft > 2,
            right: maxScrollLeft - rail.scrollLeft > 2,
        });
    }, []);

    useEffect(() => {
        const rail = scrollRef.current;
        if (!rail) return;
        const frame = requestAnimationFrame(updateScrollState);
        const resizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(updateScrollState);
        resizeObserver?.observe(rail);
        rail.addEventListener('scroll', updateScrollState, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            rail.removeEventListener('scroll', updateScrollState);
        };
    }, [children, updateScrollState]);

    const move = (direction: -1 | 1) => {
        const rail = scrollRef.current;
        if (!rail) return;
        rail.scrollBy({
            left: direction * Math.max(rail.clientWidth * 0.72, 220),
            behavior: 'smooth',
        });
    };

    return (
        <div className="tour-filter-rail">
            <button
                type="button"
                className="tour-filter-rail__control"
                aria-label={`${label} 이전 항목`}
                disabled={!scrollState.left}
                onClick={() => move(-1)}
            >
                <span aria-hidden="true">‹</span>
            </button>
            <div
                ref={scrollRef}
                role="group"
                aria-label={label}
                aria-busy={busy}
                className="tour-filter-rail__scroll"
            >
                {children}
            </div>
            <button
                type="button"
                className="tour-filter-rail__control"
                aria-label={`${label} 다음 항목`}
                disabled={!scrollState.right}
                onClick={() => move(1)}
            >
                <span aria-hidden="true">›</span>
            </button>
        </div>
    );
}

export default function TourExploreScreen(_props: ScreenControllerProps) {
    const searchParams = useSearchParams();
    const [category, setCategory] = useState('39');
    // 진입 시점의 ?area= 만 반영한다. 이후 칩 선택은 URL과 무관하게 움직인다.
    const [areaCode, setAreaCode] = useState(() => resolveAreaParam(searchParams?.get('area')));
    const [sigungu, setSigungu] = useState('');
    const [areas, setAreas] = useState<TourRegion[]>(FALLBACK_AREAS);
    const [districts, setDistricts] = useState<TourRegion[]>(FALLBACK_SEOUL_DISTRICTS);
    const [regionsLoading, setRegionsLoading] = useState(true);
    const [regionError, setRegionError] = useState<string | null>(null);
    const [arrange, setArrange] = useState('A');
    const [pois, setPois] = useState<TourPoi[]>([]);
    // 성지는 서버가 최대 300건(TourService.HOLY_MAX_RESULTS)을 한 번에 내려준다.
    // 전부 펼치면 카드 300장과 사진 300장이 한꺼번에 붙는다. 화면에는 끊어서 그린다.
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // 작품/아티스트 성지 필터 (V91): 검색어 → 자동완성 → 선택 칩.
    const [contentQuery, setContentQuery] = useState('');
    const [contentOptions, setContentOptions] = useState<HolyContentOption[]>([]);
    const [selectedContent, setSelectedContent] = useState<HolyContentOption | null>(null);
    const [selected, setSelected] = useState<TourPoi | null>(null);
    const [saved, setSaved] = useState<Set<string>>(new Set());
    const dialogTitleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const selectedAreaName = areas.find((area) => area.code === areaCode)?.name ?? '선택 지역';
    // 전국 성지 시드(V90)는 시·군·구 코드가 없어 이름(주소 매칭)으로 거른다.
    const selectedSigunguName = sigungu
        ? districts.find((district) => district.code === sigungu)?.name ?? ''
        : '';

    const closePlace = useCallback(() => {
        const returnFocusTarget = returnFocusRef.current;
        setSelected(null);
        queueMicrotask(() => {
            if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
        });
    }, []);

    useEffect(() => {
        let alive = true;
        queueMicrotask(() => {
            if (!alive) return;
            try {
                const raw = localStorage.getItem(SAVED_KEY);
                if (raw) setSaved(new Set<string>(JSON.parse(raw)));
            } catch { /* noop */ }
        });
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        let alive = true;
        const loadAreas = async () => {
            try {
                const list = await fetchTourAreas();
                if (alive && list.length > 0) setAreas(list);
            } catch {
                if (alive) setRegionError('지역 목록을 새로 불러오지 못해 기본 지역을 표시해요.');
            }
        };
        void loadAreas();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        let alive = true;
        const loadDistricts = async () => {
            setRegionsLoading(true);
            setRegionError(null);
            try {
                const list = await fetchTourDistricts(areaCode);
                if (alive) setDistricts(list);
            } catch {
                if (!alive) return;
                setDistricts(areaCode === '1' ? FALLBACK_SEOUL_DISTRICTS : []);
                setRegionError('시·군·구 목록을 불러오지 못했어요. 지역 전체로 탐색할 수 있어요.');
            } finally {
                if (alive) setRegionsLoading(false);
            }
        };
        void loadDistricts();
        return () => { alive = false; };
    }, [areaCode]);

    useEffect(() => {
        let alive = true;
        const loadPois = async () => {
            await Promise.resolve();
            if (!alive) return;
            setLoading(true);
            setError(null);
            // 조건이 바뀌면 목록도 처음부터다. 이전 페이지 수를 물려받으면 안 된다.
            setVisibleCount(PAGE_SIZE);
            try {
                if (isHolyCategory(category)) {
                    const list = await fetchHolyPois({
                        areaCode, sigunguCode: sigungu, sigunguName: selectedSigunguName,
                        contentSqno: selectedContent?.contentSqno,
                        kind: category === 'HOLY_FOOD' ? 'FOOD' : undefined,
                    });
                    if (alive) setPois(list);
                } else {
                    const list = await fetchTourPois({ areaCode, sigunguCode: sigungu, contentTypeId: category, arrange, numOfRows: 24 });
                    if (alive) setPois(list);
                }
            } catch {
                if (alive && category === 'HOLY') {
                    setPois(HOLY_SITES.filter((site) =>
                        site.areaCode === areaCode && (!sigungu || site.sigunguCode === sigungu)));
                }
                if (alive && category !== 'HOLY') setError('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
                if (alive && category === 'HOLY_FOOD') setPois([]);
            } finally {
                if (alive) setLoading(false);
            }
        };
        void loadPois();
        return () => { alive = false; };
    }, [areaCode, category, sigungu, arrange, selectedSigunguName, selectedContent?.contentSqno]);

    // 작품/아티스트 자동완성 — 성지 계열 카테고리에서 2자 이상 입력 시 300ms 디바운스 조회.
    useEffect(() => {
        if (!isHolyCategory(category) || contentQuery.trim().length < 2) {
            setContentOptions([]);
            return;
        }
        let alive = true;
        const timer = setTimeout(async () => {
            try {
                const options = await fetchHolyContents({ q: contentQuery.trim(), limit: 8 });
                if (alive) setContentOptions(options);
            } catch {
                if (alive) setContentOptions([]);
            }
        }, 300);
        return () => { alive = false; clearTimeout(timer); };
    }, [category, contentQuery]);

    useEffect(() => {
        if (loading || error || pois.length === 0) return;
        trackEvent('view_item_list', {
            item_list_name: 'tour_explore',
            item_count: pois.length,
            category,
            region: `${areaCode}:${sigungu || 'all'}`,
        });
    }, [areaCode, category, error, loading, pois.length, sigungu]);

    useEffect(() => {
        if (!selected) return;

        closeButtonRef.current?.focus();
        const handleDialogKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePlace();
                return;
            }

            if (event.key !== 'Tab') return;
            const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ) ?? []);
            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];
            if (!first || !last) return;

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleDialogKeyDown);
        return () => document.removeEventListener('keydown', handleDialogKeyDown);
    }, [closePlace, selected]);

    const toggleSave = (id?: string) => {
        if (!id) return;
        const isAdding = !saved.has(id);
        setSaved((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            try { localStorage.setItem(SAVED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
            return next;
        });
        if (isAdding) trackEvent('save_place', { item_id: id, item_category: category });
    };

    const openPlace = (place: TourPoi, trigger?: HTMLElement) => {
        returnFocusRef.current = trigger
            ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        setSelected(place);
        trackEvent('select_item', {
            item_id: place.contentId || 'unknown',
            category,
            item_list_name: 'tour_explore',
        });
    };

    const mapsUrl = (p: TourPoi) =>
        p.mapY != null && p.mapX != null
            ? `https://www.google.com/maps/search/?api=1&query=${p.mapY},${p.mapX}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title)}`;
    const selectedSourceUrl = safeExternalUrl(selected?.sourceUrl);

    return (
        <div className="page-wrap TOUR_EXPLORE tour-explore" style={{ padding: '14px 16px' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: RED }}>탐색</span>
                    <span style={{ fontSize: 13, color: '#888' }}>오늘 어디로 덕질 갈까요?</span>
                </span>
                <KakaoShareButton text="Kride에서 K-컬처 여행지·맛집을 찾아보세요!" path="/view/TOUR_EXPLORE" />
            </header>

            <section aria-label="지역 필터" style={{ marginBottom: 10 }}>
                <HorizontalFilterRail label="시·도 선택">
                    {areas.map((area) => (
                        <button
                            key={area.code}
                            type="button"
                            onClick={() => {
                                if (area.code === areaCode) return;
                                setSigungu('');
                                setAreaCode(area.code);
                            }}
                            aria-pressed={areaCode === area.code}
                            style={chipStyle(areaCode === area.code, true)}
                        >
                            {area.name}
                        </button>
                    ))}
                </HorizontalFilterRail>

                <HorizontalFilterRail
                    label={`${selectedAreaName} 시·군·구 선택`}
                    busy={regionsLoading}
                >
                    <button
                        type="button"
                        onClick={() => setSigungu('')}
                        aria-pressed={sigungu === ''}
                        style={chipStyle(sigungu === '', true)}
                    >
                        {selectedAreaName} 전체
                    </button>
                    {districts.map((district) => (
                        <button
                            key={district.code}
                            type="button"
                            onClick={() => setSigungu(district.code)}
                            aria-pressed={sigungu === district.code}
                            style={chipStyle(sigungu === district.code, true)}
                        >
                            {district.name}
                        </button>
                    ))}
                </HorizontalFilterRail>
                {regionError && (
                    <p role="status" style={{ margin: '0 2px 8px', color: '#8B4A4D', fontSize: 11 }}>
                        {regionError}
                    </p>
                )}
            </section>

            {/* 카테고리 + 정렬 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {CATEGORIES.map((c) => (
                        <button key={c.id} type="button" onClick={() => setCategory(c.id)} aria-pressed={category === c.id} style={chipStyle(category === c.id)}>
                            {c.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {SORTS.map((s) => (
                        <button key={s.code} type="button" onClick={() => setArrange(s.code)} aria-pressed={arrange === s.code} style={sortStyle(arrange === s.code)}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {isHolyCategory(category) && (
                <section aria-label="작품·아티스트 필터" style={{ marginBottom: 14 }}>
                    <label htmlFor="holy-content-search" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#791F1F', marginBottom: 6 }}>
                        작품·아티스트로 성지 찾기
                    </label>
                    {selectedContent ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ ...chipStyle(true, true), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {selectedContent.name}
                                {CONTENT_CATEGORY_LABELS[selectedContent.category]
                                    ? ` · ${CONTENT_CATEGORY_LABELS[selectedContent.category]}`
                                    : ''}
                            </span>
                            <button
                                type="button"
                                aria-label={`${selectedContent.name} 필터 해제`}
                                onClick={() => { setSelectedContent(null); setContentQuery(''); }}
                                style={{ ...chipStyle(false, true), cursor: 'pointer' }}
                            >
                                필터 해제 ✕
                            </button>
                        </div>
                    ) : (
                        <>
                            <input
                                id="holy-content-search"
                                type="search"
                                value={contentQuery}
                                onChange={(e) => setContentQuery(e.target.value)}
                                placeholder="예: 김비서가 왜 그럴까, 방탄소년단"
                                style={{
                                    width: '100%', maxWidth: 360, fontSize: 13, padding: '9px 12px',
                                    border: '0.5px solid #ddd', borderRadius: 10, outline: 'none',
                                }}
                            />
                            {contentOptions.length > 0 && (
                                <ul aria-label="작품·아티스트 검색 결과" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 360 }}>
                                    {contentOptions.map((option) => (
                                        <li key={option.contentSqno}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedContent(option);
                                                    setContentOptions([]);
                                                }}
                                                style={{
                                                    width: '100%', textAlign: 'left', fontSize: 13, padding: '8px 12px',
                                                    border: '0.5px solid #eee', borderRadius: 10, background: '#fff', cursor: 'pointer',
                                                }}
                                            >
                                                {option.name}
                                                <span style={{ color: '#999', fontSize: 12 }}>
                                                    {' · '}
                                                    {CONTENT_CATEGORY_LABELS[option.category] ?? option.category}
                                                    {` · 성지 ${option.poiCount}곳`}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </section>
            )}

            {category === 'HOLY' && (
                <section
                    aria-labelledby="holy-submit-heading"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                        marginBottom: 14, padding: '12px 14px', border: '0.5px solid #F4B8BB',
                        borderRadius: 12, background: '#FFF6F6', flexWrap: 'wrap',
                    }}
                >
                    <div style={{ flex: '1 1 220px' }}>
                        <h2 id="holy-submit-heading" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#791F1F' }}>
                            새로운 팬 성지를 알고 있나요?
                        </h2>
                        <p id="holy-submit-note" style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: '#8B4A4D' }}>
                            제보는 공개 전 운영진이 검수하며, 사진 업로드는 지원하지 않아요.
                        </p>
                    </div>
                    <a
                        href="/holy/submit"
                        aria-describedby="holy-submit-note"
                        style={{
                            flex: 'none', borderRadius: 10, background: RED, color: '#fff',
                            padding: '9px 13px', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                        }}
                    >
                        새 성지 제보하기
                    </a>
                </section>
            )}

            {loading && <div style={{ padding: 24, color: '#888' }}>불러오는 중…</div>}
            {error && <div style={{ padding: 24, color: '#A32D2D' }}>{error}</div>}
            {!loading && !error && pois.length === 0 && <div style={{ padding: 24, color: '#888' }}>표시할 장소가 없어요.</div>}

            {!loading && !error && pois.length > 0 && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                        {pois.slice(0, visibleCount).map((poi, index) => (
                            <TourPoiCard
                                key={poi.contentId ?? index}
                                poi={poi}
                                isSaved={Boolean(poi.contentId && saved.has(poi.contentId))}
                                priority={index < EAGER_CARD_COUNT}
                                onOpen={openPlace}
                                onToggleSave={toggleSave}
                            />
                        ))}
                    </div>
                    {visibleCount < pois.length && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                            <button
                                type="button"
                                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                                style={{
                                    padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    border: '0.5px solid #ddd', borderRadius: 10, background: '#fff', color: '#333',
                                }}
                            >
                                {`더 보기 (${visibleCount}/${pois.length})`}
                            </button>
                        </div>
                    )}
                </>
            )}

            {selected && (
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={dialogTitleId}
                    onClick={closePlace}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
                >
                    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, overflow: 'hidden', maxHeight: '86vh', overflowY: 'auto' }}>
                        <div style={{ background: '#f5f5f5', position: 'relative' }}>
                            <PoiImage
                                src={selected.firstImage}
                                title={selected.title}
                                variant="modal"
                                sourceUrl={selected.imageSourceUrl}
                                credit={selected.imageCredit}
                            />
                            <button ref={closeButtonRef} type="button" aria-label="닫기" onClick={closePlace} style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
                        </div>
                        <div style={{ padding: '14px 16px' }}>
                            <h2 id={dialogTitleId} style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{selected.title}</h2>
                            {selected.addr && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777' }}>{selected.addr}</p>}
                            {selected.tel && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777' }}>☎ {selected.tel}</p>}

                            {selected.recommendReason && (
                                <div style={{ background: '#FCEBEB', borderRadius: 10, padding: '10px 12px', marginTop: 12 }}>
                                    <div style={{ fontSize: 12, color: '#A32D2D', fontWeight: 500, marginBottom: 4 }}>왜 추천하나요?</div>
                                    <p style={{ margin: 0, fontSize: 12, color: '#791F1F', lineHeight: 1.5 }}>{selected.recommendReason}</p>
                                </div>
                            )}
                            {(selected.fandomInfo || selected.artist) && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 12, color: '#777', fontWeight: 500, marginBottom: 6 }}>팬덤 발자취</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {selected.artist && <span style={{ fontSize: 11, background: '#f5f5f5', border: '0.5px solid #eee', borderRadius: 20, padding: '3px 10px' }}>{selected.artist}</span>}
                                        {selected.fandomInfo && <span style={{ fontSize: 11, background: '#f5f5f5', border: '0.5px solid #eee', borderRadius: 20, padding: '3px 10px' }}>{selected.fandomInfo}</span>}
                                    </div>
                                </div>
                            )}

                            {category === 'HOLY' && selectedSourceUrl && (
                                <a href={selectedSourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 12, fontWeight: 600, color: '#1D4ED8', textDecoration: 'underline' }}>
                                    출처 확인
                                </a>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <a href={mapsUrl(selected)} target="_blank" rel="noreferrer" onClick={() => trackEvent('map_open', { provider: 'google_maps', item_id: selected.contentId || 'unknown' })} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500, color: '#fff', background: RED, borderRadius: 10, padding: '11px 0', textDecoration: 'none' }}>
                                    구글지도에서 보기
                                </a>
                                <button type="button" aria-label={selected.contentId && saved.has(selected.contentId) ? `${selected.title} 저장 취소` : `${selected.title} 저장`} onClick={() => toggleSave(selected.contentId)} style={{ border: '0.5px solid #ddd', background: 'transparent', borderRadius: 10, padding: '11px 16px', cursor: 'pointer', color: selected.contentId && saved.has(selected.contentId) ? RED : '#555', fontSize: 15 }}>
                                    {selected.contentId && saved.has(selected.contentId) ? '♥' : '♡'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function chipStyle(active: boolean, flexNone = false): React.CSSProperties {
    return {
        flex: flexNone ? 'none' : undefined,
        fontSize: 12, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
        border: '0.5px solid ' + (active ? RED : '#ddd'),
        background: active ? RED : 'transparent',
        color: active ? '#fff' : '#555',
    };
}

function sortStyle(active: boolean): React.CSSProperties {
    return {
        fontSize: 12, padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
        border: 'none', background: 'transparent',
        color: active ? RED : '#aaa', fontWeight: active ? 500 : 400,
    };
}
