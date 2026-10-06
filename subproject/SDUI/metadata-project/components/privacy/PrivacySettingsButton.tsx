'use client';

import { useContext, useEffect } from 'react';
import { ConsentContext } from '@/components/analytics/AnalyticsProvider';

interface Props {
    /**
     * menu: KrideNav 더보기 메뉴 안의 항목 (기본 사이트 셸)
     * floating: 우하단 고정 버튼 — 메뉴 항목이 어디에도 없을 때만 그려지는 폴백
     */
    variant?: 'menu' | 'floating';
}

/**
 * 개인정보(분석 동의) 설정 열기 버튼.
 * 벤치마킹 G8: 우하단 고정 버튼이 "다음" 버튼·하단 바와 겹쳐서, 기본 셸에서는 더보기 메뉴 항목으로 옮겼다.
 * 메뉴 항목이 마운트되면 Provider 에 등록되고, 떠 있는 버튼은 스스로 숨는다.
 * Provider 밖(단위 테스트 등)에서는 아무것도 그리지 않는다.
 */
export default function PrivacySettingsButton({ variant = 'floating' }: Props) {
    const context = useContext(ConsentContext);
    const register = variant === 'menu' ? context?.registerMenuEntry : undefined;
    useEffect(() => (register ? register() : undefined), [register]);

    if (!context || !context.ready || context.consent === 'unset') return null;

    if (variant === 'menu') {
        return (
            <button type="button" className="kride-privacy-menu-btn" onClick={() => context.setSettingsOpen(true)}>
                개인정보 설정
            </button>
        );
    }

    if (context.menuEntries > 0) return null;

    return (
        <button
            type="button"
            onClick={() => context.setSettingsOpen(true)}
            style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9998, border: '1px solid #ddd', borderRadius: 999, background: '#fff', color: '#555', padding: '7px 10px', fontSize: 11, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}
        >
            개인정보 설정
        </button>
    );
}
