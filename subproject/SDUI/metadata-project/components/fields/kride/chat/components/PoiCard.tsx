// PoiCard.tsx — 어시스턴트 응답 내 POI 추천 카드
'use client';
import React from 'react';
import type { KridePoi } from '@/lib/types/krideChat';

interface Props {
  poi: KridePoi;
  onView?: (poi: KridePoi) => void;
  onAdd?: (poi: KridePoi) => void;
}

export default function PoiCard({ poi, onView, onAdd }: Props) {
  return (
    <div className="kride-chat-poi">
      <div
        className="kride-chat-poi__image"
        style={poi.imageUrl ? { backgroundImage: `url(${poi.imageUrl})`, backgroundSize: 'cover' } : undefined}
      >
        {poi.tag && <div className="kride-chat-poi__tag">{poi.tag}</div>}
      </div>
      <div className="kride-chat-poi__body">
        <div className="kride-chat-poi__name">{poi.name}</div>
        {poi.address && <div className="kride-chat-poi__address">{poi.address}</div>}
        <div className="kride-chat-poi__actions">
          <button type="button" className="kride-chat-poi__btn kride-chat-poi__btn--ghost" onClick={() => onView?.(poi)}>
            지도에서 보기
          </button>
          <button type="button" className="kride-chat-poi__btn kride-chat-poi__btn--primary" onClick={() => onAdd?.(poi)}>
            일정에 추가
          </button>
        </div>
      </div>
    </div>
  );
}
