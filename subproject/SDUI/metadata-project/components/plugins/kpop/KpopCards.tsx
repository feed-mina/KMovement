'use client';

import { useId, useState } from 'react';

type CardProps = {
    data?: Record<string, any>;
    meta?: Record<string, any>;
    onAction?: (meta: Record<string, any>, data?: Record<string, any>) => void;
};

type SocialKey = 'official' | 'instagram' | 'youtube' | 'x';

type SocialLink = {
    key: SocialKey;
    label: string;
    href: string;
};

// 브랜드 로고는 외부 아이콘 패키지를 추가하지 않고 인라인 SVG path로만 그린다.
const SOCIAL_ICON_PATHS: Record<SocialKey, string> = {
    official:
        'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.4 0 2.9 2.2 3.5 5.3H8.5C9.1 6.2 10.6 4 12 4ZM8.2 11.3h7.6a17 17 0 0 1 0 3.4H8.2a17 17 0 0 1 0-3.4Zm-2 3.4H4.3a8 8 0 0 1 0-3.4h1.9a19 19 0 0 0 0 3.4Zm.4 2h1.8c.3 1.6.8 3 1.4 4a8 8 0 0 1-3.2-4Zm2.4-7.4H6.6a8 8 0 0 1 3.2-4c-.6 1-1.1 2.4-1.4 4h.6Zm3 11.7c-1.4 0-2.9-2.2-3.5-5.3h7c-.6 3.1-2.1 5.3-3.5 5.3Zm3.6-.3c.6-1 1.1-2.4 1.4-4h1.8a8 8 0 0 1-3.2 4Zm1.6-6h.2a19 19 0 0 0 0-3.4h1.9a8 8 0 0 1 0 3.4h-2.1Zm-.2-5.4c-.3-1.6-.8-3-1.4-4a8 8 0 0 1 3.2 4h-1.8Z',
    instagram:
        'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9a3.7 3.7 0 0 1-.9-1.4c-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1 0-1.7.2-2.1.4-.5.2-.9.4-1.2.8-.4.3-.6.7-.8 1.2-.2.4-.3 1-.4 2.1C2.6 8.5 2.6 8.9 2.6 12s0 3.5.1 4.8c0 1.1.2 1.7.4 2.1.2.5.4.9.8 1.2.3.4.7.6 1.2.8.4.2 1 .3 2.1.4 1.3.1 1.7.1 4.8.1s3.5 0 4.8-.1c1.1 0 1.7-.2 2.1-.4.5-.2.9-.4 1.2-.8.4-.3.6-.7.8-1.2.2-.4.3-1 .4-2.1.1-1.3.1-1.7.1-4.8s0-3.5-.1-4.8c0-1.1-.2-1.7-.4-2.1a3 3 0 0 0-.8-1.2c-.3-.4-.7-.6-1.2-.8-.4-.2-1-.3-2.1-.4-1.3-.1-1.7-.1-4.8-.1Zm0 3.1a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-3.1a1.2 1.2 0 1 1 0 2.3 1.2 1.2 0 0 1 0-2.3Z',
    youtube:
        'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.3-1.6.4-3.2.4-4.8 0-1.6-.1-3.2-.4-4.8ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z',
    x: 'M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.2 3h6.3l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z',
};

function SocialIcon({ name }: { name: SocialKey }) {
    return (
        <svg className="kpop-social-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
            <path d={SOCIAL_ICON_PATHS[name]} />
        </svg>
    );
}

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

function isValidHttpsUrl(url: unknown) {
    if (!url) return false;
    try {
        return new URL(String(url)).protocol === 'https:';
    } catch {
        return false;
    }
}

function socialLinks(data?: Record<string, any>): SocialLink[] {
    const links: SocialLink[] = [];
    const officialUrl = data?.officialUrl || data?.official_url;
    const instagramUrl = data?.instagramUrl || data?.instagram_url;
    const youtubeUrl = data?.youtubeUrl || data?.youtube_url;
    const xUrl = data?.xUrl || data?.x_url;

    if (isValidHttpsUrl(officialUrl)) links.push({ key: 'official', label: '공식 사이트', href: String(officialUrl) });
    if (isValidHttpsUrl(instagramUrl)) links.push({ key: 'instagram', label: 'Instagram', href: String(instagramUrl) });
    if (isValidHttpsUrl(youtubeUrl)) links.push({ key: 'youtube', label: 'YouTube', href: String(youtubeUrl) });
    if (isValidHttpsUrl(xUrl)) links.push({ key: 'x', label: 'X', href: String(xUrl) });

    return links;
}

export function KpopArtistCard({ data, meta, onAction }: CardProps) {
    const titleId = useId();
    const [followed, setFollowed] = useState(Boolean(data?.followed));
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const name = artistName(data);
    const imageUrl = data?.imageUrl || data?.image_url;
    const links = socialLinks(data);
    const isDetail = String(meta?.componentId || '').includes('_detail');
    const nameEn = data?.nameEn || data?.name_en;
    const subtitle = nameEn && nameEn !== name ? String(nameEn) : '';
    const profile = data?.profile || '이벤트와 팬 여행 정보를 확인해 보세요.';

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
                {subtitle && <p className="kpop-card-subtitle">{subtitle}</p>}
                <p>{profile}</p>
                {links.length > 0 && (
                    <div className="kpop-social-links" aria-label={`${name} 공식 및 SNS 링크`}>
                        {links.map((link) => (
                            <a
                                key={link.key}
                                className={`kpop-social-link kpop-social-link-${link.key}`}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                title={`${name} ${link.label}`}
                                aria-label={`${name} ${link.label} (새 창)`}
                            >
                                <SocialIcon name={link.key} />
                                {isDetail && <span className="kpop-social-label">{link.label}</span>}
                            </a>
                        ))}
                    </div>
                )}
                {isDetail && links.length === 0 && (
                    <p className="kpop-evidence">등록된 공식 채널이 아직 없습니다.</p>
                )}
                <div className="kpop-card-actions">
                    {!isDetail && (
                        <button
                            type="button"
                            onClick={() => onAction?.({
                                ...meta,
                                actionType: 'ROUTE',
                                actionUrl: `/view/KPOP_ARTIST_DETAIL/${encodeURIComponent(String(data?.slug || data?.id || ''))}`,
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
    if (meta?.componentId === 'kpop_event_card' && !data) {
        return (
            <article className="kpop-card kpop-event-card kpop-empty-state" aria-live="polite">
                <div className="kpop-card-body">
                    <span className="kpop-eyebrow">EVENT</span>
                    <h3>다가오는 일정 안내</h3>
                    <p>아직 등록된 검수 완료 일정이 없습니다. 아티스트를 팔로우하면 해당 일정이 먼저 표시됩니다.</p>
                </div>
            </article>
        );
    }

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
                <span className="kpop-eyebrow">
                    {data?.artistNameKo || data?.artistName || 'EVENT'}
                    {data?.followed && <span className="kpop-followed-badge">팔로우 중</span>}
                </span>
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