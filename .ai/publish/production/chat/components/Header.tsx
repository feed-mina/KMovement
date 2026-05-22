// Header.tsx
'use client';
import React from 'react';

type Status = 'idle' | 'thinking' | 'streaming';

interface Props {
  title: string;
  status?: Status;
  variant?: 'full' | 'sheet';
  onClose?: () => void;
}

export default function Header({ title, status = 'idle', variant = 'full', onClose }: Props) {
  const statusText =
    status === 'streaming' ? '● 답변 생성 중...' :
    status === 'thinking' ? '○ 분석 중' :
    'ONLINE · RAG + Neo4j';

  return (
    <div className="kride-chat-header" data-variant={variant}>
      <div className="kride-chat-header__brand">
        <div className="kride-chat-header__logo">K</div>
        <div>
          <div className="kride-chat-header__title">{title}</div>
          <div
            className={
              'kride-chat-header__status' +
              (status === 'streaming' ? ' kride-chat-header__status--streaming' : '')
            }
          >
            {statusText}
          </div>
        </div>
      </div>
      {onClose && (
        <button type="button" className="kride-chat-header__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      )}
    </div>
  );
}
