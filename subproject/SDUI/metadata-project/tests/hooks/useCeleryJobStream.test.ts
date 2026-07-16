import { renderHook, waitFor } from '@testing-library/react';

import {
  consumeCeleryJobStream,
  useCeleryJobStream,
  type CeleryJobSnapshot,
} from '@/lib/hooks/useCeleryJobStream';

const TASK_ID = '123e4567-e89b-42d3-a456-426614174000';


function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: jest.fn(async () => {
          if (index >= chunks.length) return { value: undefined, done: true };
          return { value: encoder.encode(chunks[index++]), done: false };
        }),
        cancel: jest.fn(async () => undefined),
      }),
    },
  } as unknown as Response;
}


describe('consumeCeleryJobStream', () => {
  it('parses split state events, ignores heartbeat, and stops at DONE', async () => {
    const snapshots: CeleryJobSnapshot[] = [];
    const response = streamResponse([
      `data: {"ok":true,"task_id":"${TASK_ID}","status":"VIDEO_RUNNING","celery_status":"VIDEO_RUNNING","meta":{"progress":20}}\n\n: heart`,
      `beat\n\ndata: {"ok":true,"task_id":"${TASK_ID}","status":"SUCCESS","celery_status":"SUCCESS","meta":{"progress":100}}\n\ndata: [DONE]\n\n`,
    ]);

    const completed = await consumeCeleryJobStream(
      response,
      new AbortController().signal,
      (snapshot) => snapshots.push(snapshot),
    );

    expect(completed).toBe(true);
    expect(snapshots.map((snapshot) => snapshot.meta?.progress)).toEqual([20, 100]);
  });
});


describe('useCeleryJobStream', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses the authenticated same-origin proxy and falls back to polling', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, body: null })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          task_id: TASK_ID,
          status: 'SUCCESS',
          celery_status: 'SUCCESS',
          meta: { step: 'complete', progress: 100 },
          result: { result_url: 'https://example.com/video.mp4' },
        }),
      });
    global.fetch = fetchMock as typeof fetch;

    const { result } = renderHook(() => useCeleryJobStream<{ result_url: string }>(TASK_ID));

    await waitFor(() => expect(result.current.isComplete).toBe(true));

    expect(result.current.usingPolling).toBe(true);
    expect(result.current.progress).toBe(100);
    expect(result.current.result?.result_url).toBe('https://example.com/video.mp4');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/jobs/celery/${TASK_ID}/stream`,
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'text/event-stream' },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/jobs/celery/${TASK_ID}`,
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }),
    );
  });
});
