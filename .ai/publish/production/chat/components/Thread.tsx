// Thread.tsx — 자동 스크롤 메시지 리스트
'use client';
import React, { useEffect, useRef } from 'react';
import Bubble from './Bubble';
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

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div ref={ref} className="kride-chat-thread">
      {messages.map((m, i) => (
        <Bubble key={m.id ?? i} role={m.role} streaming={m.streaming}>
          {m.text && <div>{m.text}</div>}

          {m.pois && m.pois.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: m.text ? 10 : 0 }}>
              {m.pois.map((p, j) => (
                <PoiCard key={p.id ?? j} poi={p} onView={onPoiView} onAdd={onPoiAdd} />
              ))}
            </div>
          )}

          {m.itinerary && (
            <div style={{ marginTop: m.text ? 10 : 0 }}>
              <ItineraryCard itinerary={m.itinerary} onApply={onApplyItinerary} />
            </div>
          )}

          {m.error && (
            <div
              style={{
                marginTop: 8, padding: '6px 10px', borderRadius: 8,
                background: 'rgba(229,9,20,0.08)', border: '1px solid rgba(229,9,20,0.3)',
                fontSize: 11.5, color: '#FCA5A5',
              }}
            >
              {m.error}
            </div>
          )}
        </Bubble>
      ))}
    </div>
  );
}
