// EmptyState.tsx — 첫 진입 화면 (메시지 없음)
'use client';
import React from 'react';
import type { KrideForm } from '@/lib/types/krideChat';

interface Props {
  context?: KrideForm | null;
}

export default function EmptyState({ context }: Props) {
  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 20px', gap: 14,
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #E50914, #8B0610)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anton, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff',
          boxShadow: '0 12px 30px rgba(229,9,20,0.25)',
        }}
      >
        K
      </div>
      <div>
        <h2
          style={{
            margin: 0, fontWeight: 800, fontSize: 22, color: '#fff',
            lineHeight: 1.25, wordBreak: 'keep-all', letterSpacing: '-0.02em',
          }}
        >
          안녕하세요,<br />어떤 여행을 도와드릴까요?
        </h2>
        <p
          style={{
            margin: '10px 0 0', fontSize: 13, lineHeight: 1.55,
            color: 'rgba(255,255,255,0.62)', wordBreak: 'keep-all',
          }}
        >
          아래 추천 질문을 누르거나 직접 입력해 주세요. 일정·POI·이동 동선까지 같이 잡아드려요.
        </p>
      </div>

      {context && (context.selectedArtists?.length || context.selectedRegions?.length) && (
        <div
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.42)',
            }}
          >
            YOUR CONTEXT
          </div>
          <div style={{ fontSize: 12, color: '#fff', wordBreak: 'keep-all' }}>
            {context.duration ?? '여행기간 미선택'}
            {context.selectedRegions?.length ? ` · ${context.selectedRegions.map((r) => r.name).join(' · ')}` : ''}
            {context.selectedArtists?.length ? ` · 아티스트 ${context.selectedArtists.length}명` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
