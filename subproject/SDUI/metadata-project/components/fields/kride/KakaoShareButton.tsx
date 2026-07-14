'use client';

import { useState } from 'react';
import { loadKakaoShare } from '@/lib/kakao/loadKakaoShare';

// Kakao recipients must receive a URL that is reachable outside the container.
// A stale build-time env can still contain localhost, so never trust a local origin
// for a link that will leave the current browser.
const DEPLOYED_SITE_URL = 'https://yerin.duckdns.org';
const CONFIGURED_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function isLocalOrigin(origin?: string | null) {
    if (!origin) return true;
    try {
        const hostname = new URL(origin).hostname.toLowerCase();
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    } catch {
        return true;
    }
}

export function getShareUrl(path: string) {
    const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const publicOrigin = !isLocalOrigin(CONFIGURED_SITE_URL)
        ? CONFIGURED_SITE_URL!
        : !isLocalOrigin(runtimeOrigin)
            ? runtimeOrigin!
            : DEPLOYED_SITE_URL;
    return new URL(path, publicOrigin).toString();
}

async function shareWithoutKakao(text: string, url: string) {
    if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'KRIDE', text, url });
        return;
    }
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert('공유 링크를 복사했어요.');
        return;
    }
    throw new Error('share fallback unavailable');
}

interface Props {
    text: string;   // 공유 메시지
    path: string;   // 공유할 앱 경로 (예: /view/ROUTE_PLANNER)
    label?: string;
}

// 카카오톡 친구에게 공유(공유 픽커). Epic #74.
export default function KakaoShareButton({ text, path, label = '공유' }: Props) {
    const [busy, setBusy] = useState(false);

    const onShare = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const Kakao = await loadKakaoShare();
            const url = getShareUrl(path);
            Kakao.Share.sendDefault({
                objectType: 'text',
                text,
                link: { webUrl: url, mobileWebUrl: url },
            });
        } catch {
            try {
                await shareWithoutKakao(text, getShareUrl(path));
            } catch {
                alert('공유 기능을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            onClick={onShare}
            disabled={busy}
            aria-label="공유"
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, padding: '6px 12px', borderRadius: 20, cursor: busy ? 'default' : 'pointer',
                border: '0.5px solid #ddd', background: '#FEE500', color: '#3C1E1E', fontWeight: 500,
            }}
        >
            <i className="ti ti-share" aria-hidden="true" style={{ fontSize: 14 }} />
            {busy ? '공유 중…' : label}
        </button>
    );
}
