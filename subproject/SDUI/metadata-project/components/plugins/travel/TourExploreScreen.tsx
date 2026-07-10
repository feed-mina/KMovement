'use client';

import { useEffect, useState } from 'react';
import type { ScreenControllerProps } from '@/components/screens/types';
import { fetchTourPois, TourPoi } from '@/services/tourApi';

// [탐색] 화면 컨트롤러 (여행 플러그인).
// TourAPI POI(맛집/관광지)를 카드로 표시한다. Epic #74 · Dev-3(#77) 후속.

const CATEGORIES = [
    { id: '39', label: '맛집' },
    { id: '12', label: '관광지' },
    { id: '14', label: '문화시설' },
] as const;

// TourAPI 이미지 URL이 http라 https 사이트에서 mixed-content로 차단되므로 업그레이드한다.
function toHttps(url?: string): string | undefined {
    return url ? url.replace(/^http:\/\//i, 'https://') : undefined;
}

export default function TourExploreScreen(_props: ScreenControllerProps) {
    const [category, setCategory] = useState<string>('39');
    const [pois, setPois] = useState<TourPoi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        fetchTourPois({ areaCode: '1', contentTypeId: category, numOfRows: 20 })
            .then((list) => { if (alive) setPois(list); })
            .catch(() => { if (alive) setError('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [category]);

    return (
        <div className="page-wrap TOUR_EXPLORE tour-explore" style={{ padding: '14px 16px' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#E50914' }}>탐색</span>
                <span style={{ fontSize: 13, color: '#888' }}>K-컬처 여행지·맛집</span>
            </header>

            <div className="tour-explore-cats" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {CATEGORIES.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        aria-pressed={category === c.id}
                        style={{
                            fontSize: 13, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                            border: '0.5px solid ' + (category === c.id ? '#E50914' : '#ddd'),
                            background: category === c.id ? '#E50914' : 'transparent',
                            color: category === c.id ? '#fff' : '#555',
                        }}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {loading && <div style={{ padding: 24, color: '#888' }}>불러오는 중…</div>}
            {error && <div style={{ padding: 24, color: '#A32D2D' }}>{error}</div>}
            {!loading && !error && pois.length === 0 && (
                <div style={{ padding: 24, color: '#888' }}>표시할 장소가 없어요.</div>
            )}

            {!loading && !error && pois.length > 0 && (
                <div
                    className="tour-explore-grid"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}
                >
                    {pois.map((p, i) => (
                        <article
                            key={p.contentId ?? i}
                            style={{ border: '0.5px solid #eee', borderRadius: 12, overflow: 'hidden', background: '#fff' }}
                        >
                            <div style={{ height: 100, background: '#f5f5f5' }}>
                                {toHttps(p.firstImage) && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={toHttps(p.firstImage)}
                                        alt={p.title}
                                        loading="lazy"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                )}
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{p.title}</p>
                                {p.addr && (
                                    <p style={{ margin: '3px 0 0', fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.addr}
                                    </p>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
