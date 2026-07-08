'use client';

import React from 'react';
import Rai from '../../atoms/Rai';

interface Props {
  role: 'user' | 'assistant';
  streaming?: boolean;
  error?: boolean;
  children: React.ReactNode;
}

export function TypingDots() {
  return (
    <span className="kride-chat-typing" aria-label="라이가 입력 중">
      <i /><i /><i />
    </span>
  );
}

export default function Bubble({ role, streaming, error, children }: Props) {
  const isUser = role === 'user';
  const raiState = error ? 'sad' : streaming ? 'thinking' : 'success';

  return (
    <div className={`kride-chat-bubble kride-chat-bubble--${role}`}>
      {!isUser && (
        <div className="kride-chat-bubble__avatar" aria-hidden="true">
          <Rai state={raiState} size={30} />
        </div>
      )}
      <div className="kride-chat-bubble__text">
        {children}
        {streaming && <TypingDots />}
      </div>
    </div>
  );
}
