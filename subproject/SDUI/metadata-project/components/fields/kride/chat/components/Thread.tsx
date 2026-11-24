'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Bubble from './Bubble';
import { useKrideReducedMotion } from '@/components/motion/KrideMotion';
import PoiCard from './PoiCard';
import ItineraryCard from './ItineraryCard';
import type { ChatMessage, KridePoi, KrideItinerary } from '@/lib/types/krideChat';

interface Props {
  messages: ChatMessage[];
  onPoiView?: (poi: KridePoi) => void;
  onPoiAdd?: (poi: KridePoi) => void;
  onApplyItinerary?: (itinerary: KrideItinerary) => void;
}

export default function Thread({ messages, onPoiView, onPoiAdd, onApplyItinerary }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useKrideReducedMotion();
  // 장소·일정 카드는 접혀 있다가 펼쳐진다.
  const unfold = reduced ? false : { opacity: 0, height: 0 };

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div ref={ref} className="kride-chat-thread">
      {messages.map((message, index) => (
        <Bubble
          key={message.id ?? index}
          role={message.role}
          streaming={message.streaming}
          error={Boolean(message.error)}
        >
          {message.text && <div>{message.text}</div>}
          {!!message.sources?.length&&<aside className="kride-chat-sources" aria-label="답변 참고 장소 출처"><strong>참고 장소 · 출처</strong><ul>{message.sources.map((p,i)=><li key={String(p.id??i)}><a href={String(p.sourceUrl)} target="_blank" rel="noopener noreferrer">{p.name} 출처 확인</a></li>)}</ul></aside>}

          {message.pois && message.pois.length > 0 && (
            <motion.div className="kride-chat-bubble__stack" style={{ overflow: 'hidden' }}
              initial={unfold} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.28 }}>
              {message.pois.map((poi, poiIndex) => (
                <PoiCard key={poi.id ?? poiIndex} poi={poi} onView={onPoiView} onAdd={onPoiAdd} />
              ))}
            </motion.div>
          )}

          {message.itinerary && (
            <motion.div className="kride-chat-bubble__stack" style={{ overflow: 'hidden' }}
              initial={unfold} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.28 }}>
              <ItineraryCard itinerary={message.itinerary} onApply={onApplyItinerary} />
            </motion.div>
          )}

          {message.error && (
            <div className="kride-chat-bubble__error">
              {message.error}
            </div>
          )}
        </Bubble>
      ))}
    </div>
  );
}
