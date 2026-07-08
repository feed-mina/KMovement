'use client';

import React from 'react';
import Rai, { type RaiState } from './Rai';

type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface KrideButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function KrideButton({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: KrideButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`kride-ui-button kride-ui-button--${variant} kride-ui-button--${size} ${className}`.trim()}
    />
  );
}

interface KrideCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'soft' | 'danger';
}

export function KrideCard({ tone = 'default', className = '', ...props }: KrideCardProps) {
  return (
    <div
      {...props}
      className={`kride-ui-card kride-ui-card--${tone} ${className}`.trim()}
    />
  );
}

interface KrideBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'danger';
}

export function KrideBadge({ tone = 'neutral', className = '', ...props }: KrideBadgeProps) {
  return (
    <span
      {...props}
      className={`kride-ui-badge kride-ui-badge--${tone} ${className}`.trim()}
    />
  );
}

interface KrideMetricProps {
  label: string;
  value: React.ReactNode;
  tone?: 'neutral' | 'accent';
}

export function KrideMetric({ label, value, tone = 'neutral' }: KrideMetricProps) {
  return (
    <div className={`kride-ui-metric kride-ui-metric--${tone}`}>
      <span className="kride-ui-metric__value">{value}</span>
      <span className="kride-ui-metric__label">{label}</span>
    </div>
  );
}

interface KrideSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export function KrideSkeleton({
  width = '100%',
  height = 12,
  className = '',
  style,
  ...props
}: KrideSkeletonProps) {
  const sizeStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      {...props}
      className={`kride-ui-skeleton ${className}`.trim()}
      style={sizeStyle}
    />
  );
}

interface RaiStatePanelProps {
  state?: RaiState;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}

export function RaiStatePanel({
  state = 'greeting',
  eyebrow,
  title,
  description,
  children,
}: RaiStatePanelProps) {
  return (
    <div className="kride-rai-panel">
      <div className="kride-rai-panel__mascot-wrap">
        <Rai state={state} size={76} className="kride-rai-panel__mascot" />
      </div>
      <div className="kride-rai-panel__copy">
        {eyebrow && <div className="kride-rai-panel__eyebrow">{eyebrow}</div>}
        <h2 className="kride-rai-panel__title">{title}</h2>
        {description && <p className="kride-rai-panel__description">{description}</p>}
      </div>
      {children && <div className="kride-rai-panel__content">{children}</div>}
    </div>
  );
}

export function RaiLoadingState({ label = '라이가 코스를 그리는 중이에요' }: { label?: string }) {
  return (
    <div className="kride-loading-state" role="status" aria-live="polite">
      <Rai state="thinking" size={44} className="kride-loading-state__mascot" />
      <div className="kride-loading-state__body">
        <span className="kride-loading-state__label">{label}</span>
        <KrideSkeleton height={8} />
        <KrideSkeleton width="72%" height={8} />
      </div>
    </div>
  );
}
