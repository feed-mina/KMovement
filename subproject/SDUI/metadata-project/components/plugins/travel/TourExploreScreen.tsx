'use client';

import { useEffect, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import { fetchHolyPois, fetchTourPois, TourPoi } from '@/services/tourApi';
import { HOLY_SITES } from '@/lib/data/holySites';
import KakaoShareButton from '@/components/fields/kride/KakaoShareButton';
import { trackEvent } from '@/lib/analytics/dataLayer';

// [탐색] 화면 컨트롤러 (여행 플러그인). TourAPI POI를 지역·카테고리·정렬로 탐색.
// Epic #74 · #85 · 성지 #78.

const CATEGORIES = [
    { id: 'HOLY', label: '성지' },
    { id: '39', label: '맛집' },
    { id: '12', label: '관광지' },
    { id: '14', label: '문화시설' },
] as const;

// TourAPI 서울(areaCode=1) 시군구 코드
const SEOUL_DISTRICTS = [
    { code: '', label: '서울 전체' },
    { code: '1', label: '강남구' },
    { code: '23', label: '종로구' },
    { code: '24', label: '중구' },
    { code: '13', label: '마포구' },
    { code: '16', label: '성동구' },
    { code: '18', label: '송파구' },
] as const;

const SORTS = [
    { code: 'A', label: '이름순' },
    { code: 'C', label: '최신순' },
] as const;

const SAVED_KEY = 'kride:saved-pois';

function toHttps(url?: string): string | undefined {
    return url ? url.replace(/^http:\/\//i, 'https://') : undefined;
}

const RED = '#E50914';

export default function TourExploreScreen(_props: ScreenControllerProps) {
    const [category, setCategory] = useState('39');
    const [sigungu, setSigungu] = useState('');
    const [arrange, setArrange] = useState('A');
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<TourPoi | null>(null);
    const [saved, setSaved] = useState<Set<string>>(new Set());

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
        const loadPois = async () => {
            await Promise.resolve();
            if (!alive) return;
            setLoading(true);
            setError(null);
            try {
                if (category === 'HOLY') {
                    const list = await fetchHolyPois();
                    if (alive) setPois(list.length > 0 ? list : HOLY_SITES);
                } else {
                    const list = await fetchTourPois({ areaCode: '1', sigunguCode: sigungu, contentTypeId: category, arrange, numOfRows: 24 });
                    if (alive) setPois(list);
                }
            } catch {
                if (alive && category === 'HOLY') setPois(HOLY_SITES);
                if (alive && category !== 'HOLY') setError('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
            } finally {
                if (alive) setLoading(false);
            }
        };
        void loadPois();
        return () => { alive = false; };
    }, [category, sigungu, arrange]);

    useEffect(() => {
        if (loading || error || pois.length === 0) return;
        trackEvent('view_item_list', {
            item_list_name: 'tour_explore',
            item_count: pois.length,
            category,
            region: sigungu || 'seoul_all',
        });
    }, [category, error, loading, pois.length, sigungu]);

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

    const openPlace = (place: TourPoi) => {
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

    return (
        <div className="page-wrap TOUR_EXPLORE tour-explore" style={{ padding: '14px 16px' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: RED }}>탐색</span>
                    <span style={{ fontSize: 13, color: '#888' }}>오늘 어디로 덕질 갈까요?</span>
                </span>
                <KakaoShareButton text="Kride에서 K-컬처 여행지·맛집을 찾아보세요!" path="/view/TOUR_EXPLORE" />
            </header>

            {/* 지역 필터 */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
                {SEOUL_DISTRICTS.map((d) => (
                    <button
                        key={d.code || 'all'}
                        type="button"
                        onClick={() => setSigungu(d.code)}
                        aria-pressed={sigungu === d.code}
                        style={chipStyle(sigungu === d.code, true)}
                    >
                        {d.label}
                    </button>
                ))}
            </div>

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
                    {pois.map((p, i) => {
                        const isSaved = !!p.contentId && saved.has(p.contentId);
                        return (
                            <article
                                key={p.contentId ?? i}
                                onClick={() => openPlace(p)}
                                style={{ border: '0.5px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff', cursor: 'pointer', position: 'relative' }}
                            >
                                <div style={{ height: 100, background: '#f5f5f5', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {toHttps(p.firstImage)
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={toHttps(p.firstImage)} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <span style={{ color: '#ccc', fontSize: 22 }}>♪</span>}
                                    {p.contentTypeId === 'HOLY' && (
                                        <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 10, background: RED, color: '#fff', padding: '2px 7px', borderRadius: 20 }}>성지</span>
                                    )}
                                    <button
                                        type="button"
                                        aria-label={isSaved ? '저장 취소' : '저장'}
                                        onClick={(e) => { e.stopPropagation(); toggleSave(p.contentId); }}
                                        style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.35)', color: isSaved ? RED : '#fff', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {isSaved ? '♥' : '♡'}
                                    </button>
                                </div>
                                <div style={{ padding: '8px 10px' }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{p.title}</p>
                                    {p.addr && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.addr}</p>}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {selected && (
                <div
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setSelected(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
                >
                    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, overflow: 'hidden', maxHeight: '86vh', overflowY: 'auto' }}>
                        <div style={{ height: 140, background: '#f5f5f5', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {toHttps(selected.firstImage)
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={toHttps(selected.firstImage)} alt={selected.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={{ color: '#bbb', fontSize: 13 }}>이미지 없음</span>}
                            <button type="button" aria-label="닫기" onClick={() => setSelected(null)} style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
                        </div>
                        <div style={{ padding: '14px 16px' }}>
                            <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{selected.title}</p>
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

                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <a href={mapsUrl(selected)} target="_blank" rel="noreferrer" onClick={() => trackEvent('map_open', { map_provider: 'google_maps', item_id: selected.contentId || 'unknown' })} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500, color: '#fff', background: RED, borderRadius: 10, padding: '11px 0', textDecoration: 'none' }}>
                                    구글지도에서 보기
                                </a>
                                <button type="button" onClick={() => toggleSave(selected.contentId)} style={{ border: '0.5px solid #ddd', background: 'transparent', borderRadius: 10, padding: '11px 16px', cursor: 'pointer', color: selected.contentId && saved.has(selected.contentId) ? RED : '#555', fontSize: 15 }}>
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
