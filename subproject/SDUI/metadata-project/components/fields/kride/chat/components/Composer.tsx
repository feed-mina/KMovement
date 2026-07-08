'use client';

import React, { useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
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
          placeholder="어디로 떠나볼까요?"
          disabled={disabled && !onAbort}
        />
        <button
          type="button"
          aria-label="음성 입력"
          className="kride-chat-composer__voice"
        >
          음성
        </button>
      </div>
      {disabled && onAbort ? (
        <button
          type="button"
          className="kride-chat-composer__send"
          onClick={onAbort}
          aria-label="답변 중지"
        >
          중지
        </button>
      ) : (
        <button
          type="button"
          className="kride-chat-composer__send"
          onClick={submit}
          disabled={!val.trim()}
          aria-label="전송"
        >
          전송
        </button>
      )}
    </div>
  );
}
