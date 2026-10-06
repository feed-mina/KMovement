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
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import { useKrideChatStream } from '@/lib/hooks/useKrideChatStream';
import type { KrideForm } from '@/lib/types/krideChat';
import Header, { type Status as HeaderStatus } from './components/Header';
import Thread from './components/Thread';
import EmptyState from './components/EmptyState';
import Suggestions from './components/Suggestions';
import Composer from './components/Composer';
import { RaiLoadingState } from '../atoms/KridePrimitives';

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
  onCloseModal?: () => void;
}

const DEFAULT_SUGGESTIONS = [
  '서울 당일치기 코스 짜줘',
  '서울 문화 장소 추천',
  '서울역사박물관은 어디에 있나요?',
];

export default function KrideChatComponent({ meta, data, onCloseModal }: KrideChatComponentProps) {
  const containerClass = meta?.cssClass || meta?.css_class || '';
  const title = meta?.labelText || meta?.label_text || 'K-RIDE 여행봇';
  const suggestions = data?.suggestions ?? DEFAULT_SUGGESTIONS;

  const auth=useAuth();
  const { messages, isLoading, error, send, abort, reset, retry } = useKrideChatStream({
    contextOverride: data?.contextOverride,
  });
  React.useEffect(()=>{reset();return()=>abort()},[auth.user?.userSqno]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const hasChatError = Boolean(error || latestAssistantMessage?.error);
  const activeStatus: HeaderStatus = isLoading
    ? messages[messages.length - 1]?.streaming
      ? 'streaming'
      : 'thinking'
    : 'idle';
  const status: HeaderStatus = hasChatError ? 'error' : activeStatus;

  if(auth.isLoading)return <p role="status">로그인 확인 중…</p>;
  if(!auth.isLoggedIn)return <div className="kride-empty"><p>로그인 후 여행봇을 이용할 수 있어요.</p><Link className="kride-primary-button" href="/view/LOGIN_PAGE?returnTo=%2Fview%2FCHAT">로그인하고 시작하기</Link></div>;

  return (
    <div className={`kride-chat-container ${containerClass}`}>
      <Header
        title={title}
        status={status}
        onClose={() => {
          reset();
          if (onCloseModal) onCloseModal();
        }}
        variant={onCloseModal ? 'sheet' : 'full'}
      />
      <p className="kride-chat-scope">서울 당일치기 일반 장소를 시험 중입니다. 아티스트 연관·영업시간·가격은 확인되지 않았습니다.</p>

      {isEmpty ? (
        <div className="kride-chat-empty">
          {isLoading ? (
            <RaiLoadingState />
          ) : (
            <>
              <EmptyState context={context} />
              <Suggestions items={suggestions} onPick={(s) => void send(s)} />
            </>
          )}
        </div>
      ) : (
        <Thread messages={messages} />
      )}

      {error&&<div role="alert" className="kride-chat-retry"><p>{error}</p><button disabled={isLoading} onClick={()=>void retry()}>다시 시도</button></div>}
      <button className="kride-chat-end" onClick={()=>{reset();onCloseModal?.()}}>대화 종료</button>

      <Composer
        onSend={(text) => void send(text)}
        disabled={isLoading}
        onAbort={isLoading ? abort : undefined}
      />
    </div>
  );
}
