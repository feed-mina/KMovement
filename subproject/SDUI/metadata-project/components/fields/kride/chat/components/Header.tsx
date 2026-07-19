// Header.tsx
'use client';

import React from 'react';
import Rai, { type RaiState } from '../../atoms/Rai';

export type Status = 'idle' | 'thinking' | 'streaming' | 'error';

const STATUS_TO_RAI: Record<Status, RaiState> = {
  idle: 'greeting',
  thinking: 'thinking',
  streaming: 'success',
  error: 'sad',
};

interface Props {
  title: string;
  status?: Status;
  variant?: 'full' | 'sheet';
  onClose?: () => void;
}

export default function Header({ title, status = 'idle', variant = 'full', onClose }: Props) {
  const statusText =
    status === 'error' ? '코스를 못 찾았어요. 조건을 바꿔볼까요?' :
    status === 'streaming' ? '라이가 답변을 정리하고 있어요' :
    status === 'thinking' ? '라이가 코스를 그리는 중이에요' :
    '라이가 코스를 함께 볼게요';

  const statusClassName = [
    'kride-chat-header__status',
    status === 'streaming' ? 'kride-chat-header__status--streaming' : '',
    status === 'error' ? 'kride-chat-header__status--error' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="kride-chat-header" data-variant={variant} data-status={status}>
      <div className="kride-chat-header__brand">
        <Rai state={STATUS_TO_RAI[status]} size={36} className="kride-chat-header__mascot" />
        <div>
          <div className="kride-chat-header__title">{title}</div>
          <div className={statusClassName}>
            {statusText}
          </div>
        </div>
      </div>
      {onClose && (
        <button type="button" className="kride-chat-header__close" onClick={onClose} aria-label="Close">
          x
        </button>
      )}
    </div>
  );
}
