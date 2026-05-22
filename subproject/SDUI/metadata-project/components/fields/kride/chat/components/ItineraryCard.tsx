// ItineraryCard.tsx — 일정 미리보기 + FOCUS 적용 CTA
'use client';
import React, { useState } from 'react';
import type { KrideItinerary } from '@/lib/types/krideChat';

interface Props {
  itinerary: KrideItinerary;
  onApply?: (itinerary: KrideItinerary) => void;
}

export default function ItineraryCard({ itinerary, onApply }: Props) {
  const [openDay, setOpenDay] = useState<number>(0);
  const days = itinerary.days ?? [];

  const totalStops = days.reduce(
    (acc, d) => acc + (d.morning?.places?.length ?? 0) + (d.afternoon?.places?.length ?? 0),
    0,
  );

  return (
    <div className="kride-chat-itinerary">
      <div className="kride-chat-itinerary__head">
        <div>
          <div className="kride-chat-itinerary__kicker">ITINERARY</div>
          <div className="kride-chat-itinerary__title">
            {itinerary.duration ?? `${days.length}일`} 추천 일정
          </div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.62)' }}>
          {days.length}일 · {totalStops} 스팟
        </div>
      </div>

      <div style={{ padding: '8px 8px 10px' }}>
        {days.map((d, i) => {
          const isOpen = openDay === i;
          const stops = (d.morning?.places?.length ?? 0) + (d.afternoon?.places?.length ?? 0);
          return (
            <div key={i} style={{ marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => setOpenDay(isOpen ? -1 : i)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <span>Day {d.day}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.62)' }}>
                  {isOpen ? '▾' : '▸'} {stops} stops
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '6px 10px 8px 16px' }}>
                  {([
                    ['오전', d.morning] as const,
                    ['오후', d.afternoon] as const,
                  ]).map(([label, slot]) => (
                      <div key={label} style={{ marginBottom: 6 }}>
                        <div
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 9, letterSpacing: '0.16em',
                            color: 'rgba(255,255,255,0.42)', marginBottom: 4,
                          }}
                        >
                          {label.toUpperCase()}
                        </div>
                        {(slot?.places ?? []).map((p, j) => (
                          <div key={j} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
                            <div
                              style={{
                                width: 4, height: 4, borderRadius: '50%', background: '#E50914',
                                marginTop: 7, flex: '0 0 4px',
                              }}
                            />
                            <div>
                              <div style={{ color: '#fff', fontWeight: 600 }}>{p.name}</div>
                              {(p.desc || p.description) && (
                                <div
                                  style={{
                                    color: 'rgba(255,255,255,0.62)', fontSize: 11.5,
                                    marginTop: 1, wordBreak: 'keep-all',
                                  }}
                                >
                                  {p.desc ?? p.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="kride-chat-itinerary__apply" onClick={() => onApply?.(itinerary)}>
        FOCUS 화면으로 적용 →
      </button>
    </div>
  );
}
