// Suggestions.tsx — Empty-state chips
'use client';
import React from 'react';

interface Props {
  items: string[];
  onPick: (s: string) => void;
}

export default function Suggestions({ items, onPick }: Props) {
  return (
    <div className="kride-chat-suggestions">
      {items.map((s, i) => (
        <button key={i} type="button" className="kride-chat-suggestion" onClick={() => onPick(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
