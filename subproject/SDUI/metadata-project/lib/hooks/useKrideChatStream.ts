// ─────────────────────────────────────────────────────────────────────────────
// metadata-project/lib/hooks/useKrideChatStream.ts
//
// KRIDE 챗봇 채팅 상태 + 백엔드 호출 훅.
// 하이브리드 패턴: intent 가 qa 면 SSE 스트리밍, 그 외(itinerary/recommend)는 non-stream.
//
// 백엔드 API:
//   POST /api/v1/kride/chat           — 통합 응답 {intent, reply, pois, itinerary}
//   POST /api/v1/kride/chat/stream    — SSE: data: {"content":"..."} → ... → data: "[DONE]"
//
// next.config.ts 의 rewrites: /api/* → ${BACKEND_URL}/api/* — 그대로 사용.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  ChatMessage,
  KrideChatRequest,
  KrideChatResponse,
  KrideForm,
} from '@/lib/types/krideChat';

const STORAGE_KEY = 'kride_form';

/** "당일치기" → 1, "1박2일" → 2, "2박3일" → 3 */
function durationLabelToInt(label?: string): number | undefined {
  if (!label) return undefined;
  const map: Record<string, number> = {
    '당일치기': 1, 'day': 1,
    '1박2일': 2, '1박 2일': 2, 'onenight': 2,
    '2박3일': 3, '2박 3일': 3, 'twonight': 3,
  };
  return map[label.trim()] ?? undefined;
}

/** localStorage 에서 온보딩 컨텍스트 읽기 — 서버사이드 안전 */
function readKrideForm(): KrideForm | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KrideForm) : null;
  } catch {
    return null;
  }
}

/** 프론트 간이 intent 분류 — 백엔드 KrideChatService.resolveIntent 와 동일 로직 */
function classifyIntent(msg: string): KrideChatRequest['intent'] {
  if (!msg) return 'qa';
  if (msg.includes('일정') || msg.includes('코스') || msg.includes('여행 계획')) return 'itinerary';
  if (msg.includes('추천') || msg.includes('맛집') || msg.includes('관광지') || msg.includes('촬영지')) return 'recommend';
  return 'qa';
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** kride_form + 사용자 입력 → ChatQueryRequest 빌더 */
function buildRequest(message: string, form: KrideForm | null): KrideChatRequest {
  return {
    message,
    intent: classifyIntent(message),
    artists: form?.selectedArtists?.map((a) => a.name) ?? [],
    regions: form?.selectedRegions?.map((r) => r.name) ?? [],
    purposes: form?.purposes ?? [],
    duration: durationLabelToInt(form?.duration),
    budget: form?.budget,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE 파서 — fetch + ReadableStream 으로 직접 처리 (EventSource 는 POST 불가)
// 백엔드 포맷: 줄바꿈 단위로 "data: <json or [DONE]>"
// ─────────────────────────────────────────────────────────────────────────────
async function streamSseChunks(
  url: string,
  body: KrideChatRequest,
  signal: AbortSignal,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new Error(`SSE failed: ${res.status}`);
  if (!res.body) throw new Error('SSE: response body is null');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 이벤트는 "\n\n" 으로 구분
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const ev of events) {
      // 한 이벤트 내 여러 "data:" 라인 가능 — 합쳐서 처리
      const dataLines = ev
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim());
      if (dataLines.length === 0) continue;
      const raw = dataLines.join('\n');

      if (raw === '[DONE]' || raw === '"[DONE]"') return;

      // 백엔드: emitter.send(data(Map.of("content", chunk))) → {"content":"..."}
      try {
        const parsed = JSON.parse(raw) as { content?: string };
        if (parsed.content) onChunk(parsed.content);
      } catch {
        // JSON 파싱 실패 시 raw 자체를 텍스트로 취급 (보수적)
        if (raw && raw !== '[DONE]') onChunk(raw);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 훅
// ─────────────────────────────────────────────────────────────────────────────

export interface UseKrideChatOptions {
  /** 강제 endpoint override (테스트용) */
  baseUrl?: string;
  /** 초기 컨텍스트 강제 주입 — 미지정 시 localStorage 에서 자동 로드 */
  contextOverride?: KrideForm;
  /** 모든 응답에 SSE 강제 (intent 분기 무시) */
  forceStream?: boolean;
}

export interface UseKrideChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  /** 사용자 메시지 전송 */
  send: (text: string) => Promise<void>;
  /** 진행 중인 요청 취소 */
  abort: () => void;
  /** 대화 초기화 */
  reset: () => void;
}

export function useKrideChatStream(opts: UseKrideChatOptions = {}): UseKrideChatReturn {
  const base = opts.baseUrl ?? '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateLast = useCallback(
    (patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const next = typeof patch === 'function' ? patch(last) : patch;
        return [...prev.slice(0, -1), { ...last, ...next }];
      });
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = { id: genId(), role: 'user', text: trimmed };
      const assistantMsg: ChatMessage = {
        id: genId(), role: 'assistant', text: '', streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      setError(null);

      const form = opts.contextOverride ?? readKrideForm();
      const req = buildRequest(trimmed, form);

      const controller = new AbortController();
      abortRef.current = controller;

      // 30초 타임아웃
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const useStream = opts.forceStream || req.intent === 'qa';

        if (useStream) {
          // SSE 텍스트 스트리밍
          await streamSseChunks(
            `${base}/api/v1/kride/chat/stream`,
            req,
            controller.signal,
            (chunk) => {
              updateLast((m) => ({ text: (m.text ?? '') + chunk }));
            },
          );
          updateLast({ streaming: false });
        } else {
          // 통합 응답 (POI / itinerary 포함)
          const res = await fetch(`${base}/api/v1/kride/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          // SDUI 공통 응답 래퍼 ApiResponse<T> = { success, data, message } 가능성 고려
          const json = await res.json();
          const payload: KrideChatResponse =
            json && typeof json === 'object' && 'data' in json
              ? (json as { data: KrideChatResponse }).data
              : (json as KrideChatResponse);

          updateLast({
            text: payload.reply ?? payload.recommendationText ?? '',
            pois: payload.pois,
            itinerary: payload.itinerary,
            streaming: false,
          });
        }
      } catch (e: unknown) {
        if ((e as Error)?.name === 'AbortError') {
          updateLast({ streaming: false });
          return;
        }
        const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
        setError(msg);
        updateLast({
          streaming: false,
          error: msg,
          text: '죄송합니다. 답변 중 오류가 발생했어요. 다시 시도해주세요.',
        });
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [base, isLoading, opts.contextOverride, opts.forceStream, updateLast],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setError(null);
  }, [abort]);

  return { messages, isLoading, error, send, abort, reset };
}
