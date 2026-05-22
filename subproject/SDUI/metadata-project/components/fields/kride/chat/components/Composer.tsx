// Composer.tsx — 입력창 + 음성 버튼 + 전송
'use client';
import React, { useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  /** 진행 중인 응답 취소 — disabled 일 때 표시 가능 */
  onAbort?: () => void;
}

export default function Composer({ onSend, disabled, onAbort }: Props) {
  const [val, setVal] = useState('');

  const submit = () => {
    const trimmed = val.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setVal('');
  };

  return (
    <div className="kride-chat-composer">
      <div className="kride-chat-composer__input-wrap">
        <input
          className="kride-chat-composer__input"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="어디 가고 싶으세요?"
          disabled={disabled && !onAbort}
        />
        <button
          type="button"
          aria-label="음성 입력"
          style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'rgba(255,255,255,0.62)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          🎙
        </button>
      </div>
      {disabled && onAbort ? (
        <button
          type="button"
          className="kride-chat-composer__send"
          onClick={onAbort}
          aria-label="응답 중단"
        >
          ◻
        </button>
      ) : (
        <button
          type="button"
          className="kride-chat-composer__send"
          onClick={submit}
          disabled={!val.trim()}
          aria-label="전송"
        >
          ↑
        </button>
      )}
    </div>
  );
}
