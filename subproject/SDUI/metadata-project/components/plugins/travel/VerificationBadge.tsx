'use client';

import {useId} from 'react';

export const PENDING_TOOLTIP = '아티스트와 이 장소의 관계를 아직 확인하고 있어요. 방문 전 영업 정보와 함께 다시 확인해 주세요.';

interface VerificationBadgeProps {
    status?: string | null;
    /** 카드처럼 버튼 안에 들어갈 때는 false — 포커스를 받지 않고 title 툴팁만 쓴다. */
    focusable?: boolean;
}

/** 근거가 검수 대기(PENDING)인 성지에 붙는 '확인 필요' 표시. */
export default function VerificationBadge({status, focusable = false}: VerificationBadgeProps) {
    const tipId = useId();
    if (status !== 'PENDING') return null;
    return (
        <span
            className="verification-badge"
            data-testid="verification-badge"
            title={PENDING_TOOLTIP}
            tabIndex={focusable ? 0 : undefined}
            aria-describedby={focusable ? tipId : undefined}
        >
            확인 필요
            {focusable
                ? <span id={tipId} role="tooltip" className="verification-badge__tip">{PENDING_TOOLTIP}</span>
                : <span className="sr-only">: {PENDING_TOOLTIP}</span>}
        </span>
    );
}
