// ─────────────────────────────────────────────────────────────────────────────
// metadata-project/components/fields/kride/chat/KrideChatComponent.tsx
//
// SDUI 컨테이너 — componentMap['KRIDE_CHAT'] 로 등록되는 컴포넌트.
// AIChatComponentV2 와 동일한 시그니처: { meta, data }
//
// 내부:
//   - useKrideChatStream 훅으로 SSE/non-SSE 호출 관리
//   - localStorage['kride_form'] 에서 사용자 컨텍스트 자동 로드
//   - publish/chat.jsx 의 프레젠테이션 컴포넌트 (Header/Thread/Composer/Empty/Suggestions)
//     를 TypeScript 로 추출하여 import
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { useKrideChatStream } from '@/lib/hooks/useKrideChatStream';
import type { KrideForm } from '@/lib/types/krideChat';
import Header from './components/Header';
import Thread from './components/Thread';
import EmptyState from './components/EmptyState';
import Suggestions from './components/Suggestions';
import Composer from './components/Composer';

interface KrideChatComponentProps {
  meta: {
    labelText?: string;
    label_text?: string;
    cssClass?: string;
    css_class?: string;
    actionType?: string;
    action_type?: string;
  };
  data?: {
    welcomeMessage?: string;
    suggestions?: string[];
    contextOverride?: KrideForm;
  };
}

const DEFAULT_SUGGESTIONS = [
  '1박2일 서울 코스 추천',
  '강남 데이트 코스 짜줘',
  '제주 자연 힐링 코스',
  '촬영지 위주로 코스 짜줘',
  '서울 야경 명소',
  '내 일정에 저장',
];

export default function KrideChatComponent({ meta, data }: KrideChatComponentProps) {
  const containerClass = meta?.cssClass || meta?.css_class || '';
  const title = meta?.labelText || meta?.label_text || 'K-RIDE 여행봇';
  const suggestions = data?.suggestions ?? DEFAULT_SUGGESTIONS;

  const { messages, isLoading, send, abort, reset } = useKrideChatStream({
    contextOverride: data?.contextOverride,
  });

  // EmptyState 용 컨텍스트 읽기 — contextOverride 우선, 없으면 localStorage
  const context = React.useMemo(() => {
    if (data?.contextOverride) return data.contextOverride;
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('kride_form');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [data?.contextOverride]);

  const isEmpty = messages.length === 0;
  const status = isLoading
    ? messages[messages.length - 1]?.streaming
      ? 'streaming'
      : 'thinking'
    : 'idle';

  return (
    <div className={`kride-chat-container ${containerClass}`}>
      <Header
        title={title}
        status={status}
        onClose={reset}
        variant="full"
      />

      {isEmpty ? (
        <>
          <EmptyState context={context} />
          <Suggestions items={suggestions} onPick={(s) => void send(s)} />
        </>
      ) : (
        <Thread messages={messages} />
      )}

      <Composer
        onSend={(text) => void send(text)}
        disabled={isLoading}
        onAbort={isLoading ? abort : undefined}
      />
    </div>
  );
}
