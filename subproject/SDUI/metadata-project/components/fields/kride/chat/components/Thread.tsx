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
      {messages.map((message, index) => (
        <Bubble
          key={message.id ?? index}
          role={message.role}
          streaming={message.streaming}
          error={Boolean(message.error)}
        >
          {message.text && <div>{message.text}</div>}

          {message.pois && message.pois.length > 0 && (
            <div className="kride-chat-bubble__stack">
              {message.pois.map((poi, poiIndex) => (
                <PoiCard key={poi.id ?? poiIndex} poi={poi} onView={onPoiView} onAdd={onPoiAdd} />
              ))}
            </div>
          )}

          {message.itinerary && (
            <div className="kride-chat-bubble__stack">
              <ItineraryCard itinerary={message.itinerary} onApply={onApplyItinerary} />
            </div>
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
