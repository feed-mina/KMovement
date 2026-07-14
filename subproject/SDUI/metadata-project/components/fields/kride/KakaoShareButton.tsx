'use client';

import { useState } from 'react';
import { loadKakaoShare } from '@/lib/kakao/loadKakaoShare';

// Kakao recipients must receive a URL that is reachable outside the container.
// `window.location.origin` can be localhost when the app sits behind a reverse proxy.
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yerin.duckdns.org';

function getShareUrl(path: string) {
    return new URL(path, PUBLIC_SITE_URL).toString();
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
            alert('카카오 공유를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            onClick={onShare}
            disabled={busy}
            aria-label="카카오톡으로 공유"
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
