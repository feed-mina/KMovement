'use client';

import React from 'react';
import Skeleton from './Skeleton';

interface ScreenSkeletonProps {
    /** 카드 모양 블록 수 (기본 3). 실제 콘텐츠 높이와 비슷하게 잡아 레이아웃이 튀지 않게 한다. */
    blocks?: number;
    label?: string;
    className?: string;
}

/**
 * 화면 전체 로딩용 Skeleton.
 * 개별 `Skeleton`(20px 한 줄)만 쓰면 빈 화면처럼 보이므로,
 * 제목 줄 + 카드 블록을 같은 자리에 깔아 "불러오는 중" 임을 보여준다.
 */
export default function ScreenSkeleton({ blocks = 3, label = '화면을 불러오는 중', className = '' }: ScreenSkeletonProps) {
    return (
        <div className={`screen-skeleton ${className}`.trim()} role="status" aria-live="polite" aria-label={label}>
            <Skeleton width="42%" height={28} className="screen-skeleton__title" />
            <Skeleton width="68%" height={16} className="screen-skeleton__sub" />
            {Array.from({ length: blocks }, (_, i) => (
                <Skeleton key={i} height={96} className="screen-skeleton__block" />
            ))}
        </div>
    );
}
