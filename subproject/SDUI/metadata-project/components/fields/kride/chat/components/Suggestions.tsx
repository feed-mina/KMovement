// Suggestions.tsx — Empty-state chips
'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { entranceTransition, useKrideReducedMotion } from '@/components/motion/KrideMotion';

interface Props {
  items: string[];
  onPick: (s: string) => void;
}

export default function Suggestions({ items, onPick }: Props) {
  const reduced = useKrideReducedMotion();
  // 추천 질문은 0.04초 간격으로 차례로 나타난다.
  return (
    <div className="kride-chat-suggestions">
      {items.map((s, i) => (
        <motion.button key={i} type="button" className="kride-chat-suggestion" onClick={() => onPick(s)}
          initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={entranceTransition(i)}>
          {s}
        </motion.button>
      ))}
    </div>
  );
}
