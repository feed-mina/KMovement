'use client';

import {useId} from 'react';

export const PENDING_TOOLTIP = '아티스트와 이 장소의 관계를 아직 확인하고 있어요. 방문 전 영업 정보와 함께 다시 확인해 주세요.';
export const UNOFFICIAL_TOOLTIP = '공식 발표나 언론 보도는 없고 팬들이 찾아낸 장소예요. 방문 전 영업 정보와 함께 다시 확인해 주세요.';

const BADGES: Record<string, {label: string; tip: string; tone: string}> = {
    PENDING: {label: '확인 필요', tip: PENDING_TOOLTIP, tone: 'pending'},
    UNOFFICIAL: {label: '비공식', tip: UNOFFICIAL_TOOLTIP, tone: 'unofficial'},
};

interface VerificationBadgeProps {
    status?: string | null;
    /** 카드처럼 버튼 안에 들어갈 때는 false — 포커스를 받지 않고 title 툴팁만 쓴다. */
    focusable?: boolean;
}

/** 근거가 검수 대기(PENDING)면 '확인 필요', 팬 자료로만 확인(UNOFFICIAL)이면 '비공식' 표시. */
export default function VerificationBadge({status, focusable = false}: VerificationBadgeProps) {
    const tipId = useId();
    const badge = status ? BADGES[status] : undefined;
    if (!badge) return null;
    return (
        <span
            className={`verification-badge verification-badge--${badge.tone}`}
            data-testid="verification-badge"
            data-status={status}
            title={badge.tip}
            tabIndex={focusable ? 0 : undefined}
            aria-describedby={focusable ? tipId : undefined}
        >
            {badge.label}
            {focusable
                ? <span id={tipId} role="tooltip" className="verification-badge__tip">{badge.tip}</span>
                : <span className="sr-only">: {badge.tip}</span>}
        </span>
    );
}
