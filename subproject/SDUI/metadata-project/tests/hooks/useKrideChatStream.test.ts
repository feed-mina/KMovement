import { act, renderHook } from '@testing-library/react';
import { consumeChatStream } from '@/lib/kride/consumeChatStream';
import { useKrideChatStream } from '@/lib/hooks/useKrideChatStream';

jest.mock('@/lib/analytics/dataLayer', () => ({ trackEvent: jest.fn() }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

function response(chunks: string[]) {
  const reader = {
    read: jest.fn(async () => chunks.length
      ? { done: false, value: new TextEncoder().encode(chunks.shift()!) }
      : { done: true, value: undefined }),
    cancel: jest.fn(async () => undefined), releaseLock: jest.fn(),
  };
  return { reader, value: { ok: true, status: 200, body: { getReader: () => reader } } as unknown as Response };
}

it('handles split CRLF, multiline JSON, heartbeats and exactly one completion', async () => {
  const r = response([': heartbeat\r\n\r\ndata: {"content":\r\n', 'data: "서울"}\r\n\r', '\ndata: [DONE]\r\n\r\ndata: {"content":"late"}\n\n']);
  const chunks: string[] = [];
  await consumeChatStream(r.value, new AbortController().signal, text => chunks.push(text));
  expect(chunks).toEqual(['서울']);
  expect(r.reader.cancel).toHaveBeenCalledTimes(1);
  expect(r.reader.releaseLock).toHaveBeenCalledTimes(1);
});

it.each([
  ['data: {"content":"partial"}\n\n', '중간에 끊겼습니다'],
  ['data: not-json\n\n', '형식'],
  ['data: {"error":"private upstream details"}\n\n', '생성 중 오류'],
])('rejects incomplete or invalid streams and releases the reader', async (body, error) => {
  const r = response([body]);
  await expect(consumeChatStream(r.value, new AbortController().signal, () => {})).rejects.toThrow(error);
  expect(r.reader.releaseLock).toHaveBeenCalled();
});

it.each([[401, '로그인'], [429, '한도']])('shows an actionable HTTP %s error', async (status, message) => {
  await expect(consumeChatStream({ ok: false, status } as Response, new AbortController().signal, () => {})).rejects.toThrow(String(message));
});

it('does not allow a cancelled request to change a new answer or loading state', async () => {
  let rejectOld!: (error: Error) => void;
  let resolveNew!: (value: Response) => void;
  const old = new Promise<Response>((_, reject) => { rejectOld = reject; });
  const next = new Promise<Response>(resolve => { resolveNew = resolve; });
  global.fetch = jest.fn().mockReturnValueOnce(old).mockReturnValueOnce(next);
  const { result } = renderHook(() => useKrideChatStream({ forceStream: true }));
  let first!: Promise<void>; let second!: Promise<void>;
  act(() => { first = result.current.send('first'); });
  act(() => { result.current.abort(); });
  act(() => { second = result.current.send('second'); });
  await act(async () => { rejectOld(new DOMException('Cancelled', 'AbortError')); await first; });
  expect(result.current.isLoading).toBe(true);
  await act(async () => { resolveNew(response(['data: {"content":"new only"}\n\ndata: [DONE]\n\n']).value); await second; });
  expect(result.current.messages.map(m => m.text)).toEqual(['first', '', 'second', 'new only']);
  expect(result.current.messages.every(m => !m.streaming)).toBe(true);
});

it('admits only one send in the same render and aborts on unmount', async () => {
  let signal!: AbortSignal;
  global.fetch = jest.fn((_url, init) => { signal = init!.signal!; return new Promise<Response>(() => {}); });
  const { result, unmount } = renderHook(() => useKrideChatStream());
  act(() => { void result.current.send('hello'); void result.current.send('again'); });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  unmount();
  expect(signal.aborted).toBe(true);
});
