import type { NextRequest } from 'next/server';

import { GET as getCeleryStatus } from '../../app/jobs/celery/[taskId]/route';
import { GET as getCeleryStream } from '../../app/jobs/celery/[taskId]/stream/route';


describe('same-origin Celery proxy routes', () => {
  const originalFetch = global.fetch;
  const originalResponse = global.Response;
  const originalFastApiUrl = process.env.FASTAPI_URL;
  const originalInternalApiKey = process.env.FASTAPI_INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.FASTAPI_URL = 'http://kride-fastapi:8000/';
    process.env.FASTAPI_INTERNAL_API_KEY = 'server-only-key';
  });

  const request = () => ({ signal: new AbortController().signal }) as NextRequest;

  afterEach(() => {
    global.fetch = originalFetch;
    global.Response = originalResponse;
    process.env.FASTAPI_URL = originalFastApiUrl;
    process.env.FASTAPI_INTERNAL_API_KEY = originalInternalApiKey;
    jest.restoreAllMocks();
  });

  it('injects the internal key for polling without exposing it to the browser', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, task_id: 'job/1', status: 'RUNNING' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStatus(
      request(),
      { params: Promise.resolve({ taskId: 'job/1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'RUNNING' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://kride-fastapi:8000/jobs/celery/job%2F1',
      expect.objectContaining({
        headers: { 'X-Internal-Api-Key': 'server-only-key' },
      }),
    );
  });

  it('passes the upstream SSE body through with anti-buffering headers', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"status":"RUNNING"}\n\n'));
        controller.close();
      },
    });
    const fetchMock = jest.fn().mockResolvedValue({
      body,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream; charset=utf-8' }),
    });
    global.fetch = fetchMock as typeof fetch;
    global.Response = class CapturingResponse {
      body: BodyInit | null;
      status: number;
      headers: Headers;

      constructor(responseBody?: BodyInit | null, init?: ResponseInit) {
        this.body = responseBody ?? null;
        this.status = init?.status ?? 200;
        this.headers = new Headers(init?.headers);
      }
    } as unknown as typeof Response;

    const response = await getCeleryStream(
      request(),
      { params: Promise.resolve({ taskId: 'job-1' }) },
    );

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    expect(response.body).toBe(body);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://kride-fastapi:8000/jobs/celery/job-1/stream',
      expect.objectContaining({
        headers: {
          Accept: 'text/event-stream',
          'X-Internal-Api-Key': 'server-only-key',
        },
      }),
    );
  });

  it('fails closed when the server-only key is missing', async () => {
    delete process.env.FASTAPI_INTERNAL_API_KEY;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStatus(
      request(),
      { params: Promise.resolve({ taskId: 'job-1' }) },
    );

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
