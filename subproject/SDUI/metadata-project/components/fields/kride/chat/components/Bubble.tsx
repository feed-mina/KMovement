// Bubble.tsx — 단일 메시지 + 타이핑 인디케이터
'use client';
import React from 'react';

interface Props {
  role: 'user' | 'assistant';
  streaming?: boolean;
  children: React.ReactNode;
}

export function TypingDots() {
  return (
    <span className="kride-chat-typing" aria-label="typing">
      <i /><i /><i />
    </span>
  );
}

export default function Bubble({ role, streaming, children }: Props) {
  const isUser = role === 'user';
  return (
    <div className={`kride-chat-bubble kride-chat-bubble--${role}`}>
      {!isUser && <div className="kride-chat-bubble__avatar">K</div>}
      <div className="kride-chat-bubble__text">
        {children}
        {streaming && <TypingDots />}
      </div>
    </div>
  );
}
