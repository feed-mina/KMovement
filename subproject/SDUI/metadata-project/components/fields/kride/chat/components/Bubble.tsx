'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Rai from '../../atoms/Rai';
import { useKrideReducedMotion } from '@/components/motion/KrideMotion';

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
  const reduced = useKrideReducedMotion();

  // 말풍선은 아래에서 살짝 올라오며 나타난다 (0.2초, 움직임 줄이기면 바로 표시).
  return (
    <motion.div className={`kride-chat-bubble kride-chat-bubble--${role}`}
      initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {!isUser && (
        <div className="kride-chat-bubble__avatar" aria-hidden="true">
          <Rai state={raiState} size={30} />
        </div>
      )}
      <div className="kride-chat-bubble__text">
        {children}
        {streaming && <TypingDots />}
      </div>
    </motion.div>
  );
}
