'use client';

import React from 'react';
import type { KridePoi } from '@/lib/types/krideChat';
import { KrideBadge, KrideButton } from '../../atoms/KridePrimitives';

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
        {poi.tag && <KrideBadge tone="accent" className="kride-chat-poi__tag">{poi.tag}</KrideBadge>}
      </div>
      <div className="kride-chat-poi__body">
        <div className="kride-chat-poi__name">{poi.name}</div>
        {poi.address && <div className="kride-chat-poi__address">{poi.address}</div>}
        <div className="kride-chat-poi__actions">
          {onView&&<KrideButton variant="ghost" size="sm" className="kride-chat-poi__btn" onClick={() => onView(poi)}>
            지도에서 보기
          </KrideButton>}
          {Number.isFinite(poi.lat)&&Number.isFinite(poi.lng??poi.lon)&&<a href={`https://map.kakao.com/link/map/${encodeURIComponent(poi.name)},${poi.lat},${poi.lng??poi.lon}`} target="_blank" rel="noopener noreferrer">지도 열기</a>}
          {onAdd&&<KrideButton variant="primary" size="sm" className="kride-chat-poi__btn" onClick={() => onAdd(poi)}>
            일정에 담기
          </KrideButton>}
        </div>
      </div>
    </div>
  );
}
