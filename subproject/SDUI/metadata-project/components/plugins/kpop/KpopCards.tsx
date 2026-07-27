'use client';

import { useId, useState } from 'react';

type CardProps = {
    data?: Record<string, any>;
    meta?: Record<string, any>;
    onAction?: (meta: Record<string, any>, data?: Record<string, any>) => void;
};

const artistName = (data?: Record<string, any>) =>
    data?.nameKo || data?.name_ko || data?.nameEn || data?.name || 'K-POP';

async function updateSavedState(url: string, method: 'POST' | 'DELETE') {
    const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(String(response.status));
}

export function KpopArtistCard({ data, meta, onAction }: CardProps) {
    const titleId = useId();
    const [followed, setFollowed] = useState(Boolean(data?.followed));
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const name = artistName(data);
    const imageUrl = data?.imageUrl || data?.image_url;
    const isDetail = String(meta?.componentId || '').includes('_detail');

    const toggleFollow = async () => {
        if (busy || !data?.id) return;
        setBusy(true);
        try {
            await updateSavedState(`/api/v1/kpop/artists/${data.id}/follow`, followed ? 'DELETE' : 'POST');
            setFollowed((current) => !current);
            setStatus(followed ? '팔로우를 취소했습니다.' : '팔로우했습니다.');
        } catch {
            setStatus('로그인 후 팔로우할 수 있습니다.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <article className="kpop-card" aria-labelledby={titleId}>
            <div className="kpop-card-image">
                {imageUrl ? (
                    <img src={imageUrl} alt={`${name} 아티스트 프로필`} loading="lazy" />
                ) : (
                    <span aria-hidden="true">{name.slice(0, 1)}</span>
                )}
            </div>
            <div className="kpop-card-body">
                <span className="kpop-eyebrow">ARTIST</span>
                <h3 id={titleId}>{name}</h3>
                <p>{data?.profile || '이벤트와 팬 여행 정보를 확인해 보세요.'}</p>
                <div className="kpop-card-actions">
                    {!isDetail && (
                        <button
                            type="button"
                            onClick={() => onAction?.({
                                ...meta,
                                actionType: 'ROUTE',
                                actionUrl: `/view/KPOP_ARTIST_DETAIL/${data?.id}`,
                            }, data)}
                        >
                            상세 보기
                        </button>
                    )}
                    <button type="button" aria-pressed={followed} aria-busy={busy} disabled={busy} onClick={toggleFollow}>
                        {busy ? '처리 중...' : followed ? '팔로우 취소' : '팔로우'}
                    </button>
                </div>
                {status && <small role="status">{status}</small>}
            </div>
        </article>
    );
}

export function KpopEventCard({ data, meta, onAction }: CardProps) {
    const titleId = useId();
    const [bookmarked, setBookmarked] = useState(Boolean(data?.bookmarked));
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const title = data?.titleKo || data?.title_ko || data?.titleEn || data?.title || 'K-POP 이벤트';
    const isDetail = String(meta?.componentId || '').includes('_detail');

    const toggleBookmark = async () => {
        if (busy || !data?.id) return;
        setBusy(true);
        try {
            await updateSavedState(`/api/v1/kpop/events/${data.id}/bookmark`, bookmarked ? 'DELETE' : 'POST');
            setBookmarked((current) => !current);
            setStatus(bookmarked ? '일정 저장을 취소했습니다.' : '일정을 저장했습니다.');
        } catch {
            setStatus('로그인 후 일정을 저장할 수 있습니다.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <article className="kpop-card kpop-event-card" aria-labelledby={titleId}>
            <div className="kpop-card-body">
                <span className="kpop-eyebrow">{data?.artistNameKo || data?.artistName || 'EVENT'}</span>
                <h3 id={titleId}>{title}</h3>
                <p>{[data?.region, data?.venue, data?.date].filter(Boolean).join(' · ') || '장소와 일정 확인 중'}</p>
                <p className="kpop-evidence">공식 또는 운영 검수 완료 링크를 기준으로 확인해 주세요.</p>
                <div className="kpop-card-actions">
                    {!isDetail && (
                        <button
                            type="button"
                            onClick={() => onAction?.({
                                ...meta,
                                actionType: 'ROUTE',
                                actionUrl: `/view/KPOP_EVENT_DETAIL/${data?.id}`,
                            }, data)}
                        >
                            상세 보기
                        </button>
                    )}
                    <button type="button" aria-pressed={bookmarked} aria-busy={busy} disabled={busy} onClick={toggleBookmark}>
                        {busy ? '저장 중...' : bookmarked ? '저장 취소' : '일정 저장'}
                    </button>
                </div>
                {status && <small role="status">{status}</small>}
            </div>
        </article>
    );
}