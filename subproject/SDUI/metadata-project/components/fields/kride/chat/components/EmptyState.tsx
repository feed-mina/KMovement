'use client';

import React from 'react';
import type { KrideForm } from '@/lib/types/krideChat';
import { KrideCard, RaiStatePanel } from '../../atoms/KridePrimitives';

interface Props {
  context?: KrideForm | null;
}

function formatContext(context: KrideForm) {
  const parts = [
    context.duration,
    ...(context.selectedRegions?.map((region) => region.name) ?? []),
    context.selectedArtists?.length ? `아티스트 ${context.selectedArtists.length}명` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : '아직 선택한 조건이 없어요';
}

export default function EmptyState({ context }: Props) {
  return (
    <RaiStatePanel
      state="greeting"
      eyebrow="RAI GUIDE"
      title={<>라이가 취향에 맞는 코스를 준비할게요.</>}
      description="지역, 일정, 좋아하는 분위기를 알려주시면 지도에 바로 옮길 수 있는 코스로 정리해드려요."
    >
      {context && (context.selectedArtists?.length || context.selectedRegions?.length || context.duration) && (
        <KrideCard tone="soft" className="kride-chat-context-card">
          <div className="kride-chat-context-card__label">선택한 조건</div>
          <div className="kride-chat-context-card__body">{formatContext(context)}</div>
        </KrideCard>
      )}
    </RaiStatePanel>
  );
}
