'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import {
    fetchHolyPois,
    fetchTourAreas,
    fetchTourDistricts,
    fetchTourPois,
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
    { id: '39', label: '맛집' },
    { id: '12', label: '관광지' },
    { id: '14', label: '문화시설' },
] as const;

const FALLBACK_AREAS: TourRegion[] = [{ code: '1', name: '서울' }];
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

const SORTS = [
    { code: 'A', label: '이름순' },
    { code: 'C', label: '최신순' },
] as const;

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

export default function TourExploreScreen(_props: ScreenControllerProps) {
    const [category, setCategory] = useState('39');
    const [areaCode, setAreaCode] = useState('1');
    const [sigungu, setSigungu] = useState('');
    const [areas, setAreas] = useState<TourRegion[]>(FALLBACK_AREAS);
    const [districts, setDistricts] = useState<TourRegion[]>(FALLBACK_SEOUL_DISTRICTS);
    const [regionsLoading, setRegionsLoading] = useState(true);
    const [regionError, setRegionError] = useState<string | null>(null);
    const [arrange, setArrange] = useState('A');
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<TourPoi | null>(null);
    const [saved, setSaved] = useState<Set<string>>(new Set());
    const dialogTitleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const selectedAreaName = areas.find((area) => area.code === areaCode)?.name ?? '선택 지역';

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
            try {
                if (category === 'HOLY') {
                    const list = await fetchHolyPois({ areaCode, sigunguCode: sigungu });
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
            } finally {
                if (alive) setLoading(false);
            }
        };
        void loadPois();
        return () => { alive = false; };
    }, [areaCode, category, sigungu, arrange]);

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
            item_category: category,
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
                <div
                    role="group"
                    aria-label="시·도 선택"
                    style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'thin' }}
                >
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
                </div>

                <div
                    role="group"
                    aria-label={`${selectedAreaName} 시·군·구 선택`}
                    aria-busy={regionsLoading}
                    style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'thin' }}
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
                </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                    {pois.map((poi, index) => (
                        <TourPoiCard
                            key={poi.contentId ?? index}
                            poi={poi}
                            isSaved={Boolean(poi.contentId && saved.has(poi.contentId))}
                            onOpen={openPlace}
                            onToggleSave={toggleSave}
                        />
                    ))}
                </div>
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
                                <a href={mapsUrl(selected)} target="_blank" rel="noreferrer" onClick={() => trackEvent('map_open', { map_provider: 'google_maps', item_id: selected.contentId || 'unknown' })} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500, color: '#fff', background: RED, borderRadius: 10, padding: '11px 0', textDecoration: 'none' }}>
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
