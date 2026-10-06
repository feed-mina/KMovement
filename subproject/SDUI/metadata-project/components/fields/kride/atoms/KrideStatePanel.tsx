'use client';

import React from 'react';
import Link from 'next/link';

/**
 * 공용 상태 패널 — Empty / Loading / Error / Forbidden / Offline.
 *
 * 벤치마킹(ui-benchmarking-analyst, 2026-10-06) 교집합:
 *  - 아이콘 + 제목 + "왜 이런지" 한 줄 + Primary 행동 1개 + 보조 링크 최대 2개
 *  - 오류(kind='error')는 role="alert", 나머지는 role="status"
 *  - tone='light' 가 기본. FOCUS 처럼 어두운 카드가 필요한 곳만 tone='dark'
 */
export type KrideStateKind = 'empty-first' | 'empty-filtered' | 'loading' | 'error' | 'forbidden' | 'offline';

export interface KrideStateAction {
    label: string;
    onClick?: () => void;
    href?: string;
    busy?: boolean;
    disabled?: boolean;
}

export interface KrideStateLink {
    label: string;
    href: string;
}

export interface KrideStatePanelProps {
    kind: KrideStateKind;
    tone?: 'light' | 'dark';
    title: React.ReactNode;
    /** 원인 한 줄. kind='error' 면 반드시 넣는다. */
    description?: React.ReactNode;
    icon?: React.ReactNode;
    /** 화면당 하나만. */
    primaryAction?: KrideStateAction;
    /** ghost 스타일 보조 행동 (예: 조건 바꾸기) */
    secondaryAction?: KrideStateAction;
    /** 텍스트 링크 최대 2개 */
    secondaryLinks?: KrideStateLink[];
    /** 사용자가 넣은 조건 칩 등 */
    context?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

const DEFAULT_ICON: Record<KrideStateKind, string> = {
    'empty-first': '📭',
    'empty-filtered': '🔍',
    loading: '⏳',
    error: '⚠️',
    forbidden: '🔒',
    offline: '📡',
};

function ActionButton({ action, variant }: { action: KrideStateAction; variant: 'primary' | 'ghost' }) {
    const className = `kride-state-panel__btn kride-state-panel__btn--${variant}`;
    if (action.href && !action.onClick) {
        return (
            <Link className={className} href={action.href} aria-disabled={action.disabled || undefined}>
                {action.label}
            </Link>
        );
    }
    return (
        <button
            type="button"
            className={className}
            onClick={action.onClick}
            disabled={action.disabled || action.busy}
            aria-busy={action.busy || undefined}
        >
            {action.busy ? `${action.label}…` : action.label}
        </button>
    );
}

export default function KrideStatePanel({
    kind,
    tone = 'light',
    title,
    description,
    icon,
    primaryAction,
    secondaryAction,
    secondaryLinks,
    context,
    children,
    className = '',
}: KrideStatePanelProps) {
    const role = kind === 'error' ? 'alert' : 'status';
    const links = (secondaryLinks ?? []).slice(0, 2);

    return (
        <div
            className={`kride-state-panel kride-state-panel--${kind} kride-state-panel--${tone} ${className}`.trim()}
            role={role}
            aria-live={kind === 'error' ? 'assertive' : 'polite'}
        >
            <div className="kride-state-panel__icon" aria-hidden="true">{icon ?? DEFAULT_ICON[kind]}</div>
            <div className="kride-state-panel__copy">
                <h2 className="kride-state-panel__title">{title}</h2>
                {description && <p className="kride-state-panel__description">{description}</p>}
            </div>
            {context && <div className="kride-state-panel__context">{context}</div>}
            {(primaryAction || secondaryAction) && (
                <div className="kride-state-panel__actions">
                    {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
                    {secondaryAction && <ActionButton action={secondaryAction} variant="ghost" />}
                </div>
            )}
            {links.length > 0 && (
                <div className="kride-state-panel__links">
                    {links.map((link) => (
                        <Link key={link.href + link.label} href={link.href}>{link.label}</Link>
                    ))}
                </div>
            )}
            {children}
        </div>
    );
}

/** 조건 칩 (오류 화면에서 "내가 고른 조건" 을 보여줄 때) */
export function KrideStateChips({ label, items }: { label?: string; items: { text: string; accent?: boolean }[] }) {
    if (items.length === 0) return null;
    return (
        <div className="kride-state-chips">
            {label && <div className="kride-state-chips__label">{label}</div>}
            <div className="kride-state-chips__list">
                {items.map((item, i) => (
                    <span key={`${item.text}-${i}`} className={`kride-state-chip${item.accent ? ' kride-state-chip--accent' : ''}`}>
                        {item.text}
                    </span>
                ))}
            </div>
        </div>
    );
}
