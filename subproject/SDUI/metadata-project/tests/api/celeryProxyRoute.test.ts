import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';

import { GET as getCeleryStatus } from '../../app/jobs/celery/[taskId]/route';
import { GET as getCeleryStream } from '../../app/jobs/celery/[taskId]/stream/route';
import {
  acquireCeleryStream,
  resetCeleryProxySecurityForTests,
} from '../../app/jobs/celery/_proxySecurity';


const TASK_ID = '85a9f8bb-e57b-4b8d-a1ca-5a1f34cb764a';
const INTERNAL_KEY = 'server-only-key';

class TestResponse {
  body: BodyInit | null;
  status: number;
  headers: Headers;
  ok: boolean;

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.body = body ?? null;
    this.status = init?.status ?? 200;
    this.headers = new Headers(init?.headers);
    this.ok = this.status >= 200 && this.status < 300;
  }

  async text(): Promise<string> {
    if (this.body === null) return '';
    if (typeof this.body === 'string') return this.body;
    if (
      this.body instanceof ArrayBuffer
      || Object.prototype.toString.call(this.body) === '[object ArrayBuffer]'
    ) {
      return new TextDecoder().decode(this.body as ArrayBuffer);
    }
    if (ArrayBuffer.isView(this.body)) {
      return new TextDecoder().decode(this.body as ArrayBufferView<ArrayBuffer>);
    }
    if (typeof (this.body as ReadableStream<Uint8Array>).getReader === 'function') {
      const reader = (this.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let output = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) return output + decoder.decode();
        output += decoder.decode(value, { stream: true });
      }
    }
    return String(this.body);
  }

  async json(): Promise<unknown> {
    return JSON.parse(await this.text());
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const bytes = new TextEncoder().encode(await this.text());
    return bytes.buffer;
  }
}

describe('same-origin Celery proxy routes', () => {
  const originalFetch = global.fetch;
  const originalResponse = global.Response;
  const originalFastApiUrl = process.env.FASTAPI_URL;
  const originalBackendUrl = process.env.BACKEND_URL;
  const originalInternalApiKey = process.env.FASTAPI_INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.FASTAPI_URL = 'http://kride-fastapi:8000/';
    process.env.BACKEND_URL = 'http://sdui-backend:8080/';
    process.env.FASTAPI_INTERNAL_API_KEY = INTERNAL_KEY;
    global.Response = TestResponse as unknown as typeof Response;
    resetCeleryProxySecurityForTests();
  });

  const request = (headers: Record<string, string> = {}) => ({
    headers: new Headers({ 'X-Real-IP': '203.0.113.10', ...headers }),
    signal: new AbortController().signal,
  }) as NextRequest;

  const userRequest = () => request({ Cookie: 'accessToken=signed-user-token' });
  const context = (taskId = TASK_ID) => ({ params: Promise.resolve({ taskId }) });
  const ownershipOk = () => new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const expectedJobToken = () => createHmac('sha256', INTERNAL_KEY)
    .update(TASK_ID)
    .digest('hex');

  afterEach(() => {
    global.fetch = originalFetch;
    global.Response = originalResponse;
    process.env.FASTAPI_URL = originalFastApiUrl;
    process.env.BACKEND_URL = originalBackendUrl;
    process.env.FASTAPI_INTERNAL_API_KEY = originalInternalApiKey;
    resetCeleryProxySecurityForTests();
    jest.restoreAllMocks();
  });

  it('checks Spring ownership before polling and derives service-only headers', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(ownershipOk())
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: true, task_id: TASK_ID, status: 'RUNNING' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStatus(userRequest(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'RUNNING' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `http://sdui-backend:8080/api/v1/celery/jobs/${TASK_ID}/ownership`,
      expect.objectContaining({
        headers: expect.objectContaining({ Cookie: 'accessToken=signed-user-token' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://kride-fastapi:8000/jobs/celery/${TASK_ID}`,
      expect.objectContaining({
        headers: {
          'X-Celery-Job-Token': expectedJobToken(),
          'X-Internal-Api-Key': INTERNAL_KEY,
        },
      }),
    );
  });

  it('passes an owned SSE body through with anti-buffering headers', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"status":"RUNNING"}\n\n'));
        controller.close();
      },
    });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(ownershipOk())
      .mockResolvedValueOnce({
        body,
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/event-stream; charset=utf-8' }),
      });
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStream(userRequest(), context());

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    await expect(response.text()).resolves.toContain('data: {"status":"RUNNING"}');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://kride-fastapi:8000/jobs/celery/${TASK_ID}/stream`,
      expect.objectContaining({
        headers: {
          Accept: 'text/event-stream',
          'X-Celery-Job-Token': expectedJobToken(),
          'X-Internal-Api-Key': INTERNAL_KEY,
        },
      }),
    );
  });

  it('rejects unauthenticated requests before contacting either backend', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStatus(request(), context());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not reveal a task owned by another user', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStream(userRequest(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Celery job was not found.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects non-UUID task IDs before ownership lookup', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStatus(userRequest(), context('job-1'));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a constant-time internal smoke bypass and still derives the job token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, task_id: TASK_ID, status: 'SUCCESS' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStatus(
      request({ 'X-Internal-Api-Key': INTERNAL_KEY }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://kride-fastapi:8000/jobs/celery/${TASK_ID}`,
      expect.objectContaining({
        headers: {
          'X-Celery-Job-Token': expectedJobToken(),
          'X-Internal-Api-Key': INTERNAL_KEY,
        },
      }),
    );
  });

  it('caps concurrent SSE streams per proxy-visible client address', async () => {
    const openBodies: ReadableStream<Uint8Array>[] = [];
    const fetchMock = jest.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('http://sdui-backend:8080/')) return ownershipOk();
      const body = new ReadableStream<Uint8Array>({ start() {} });
      openBodies.push(body);
      return {
        body,
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      };
    });
    global.fetch = fetchMock as typeof fetch;

    const responses = await Promise.all([
      getCeleryStream(userRequest(), context()),
      getCeleryStream(userRequest(), context()),
      getCeleryStream(userRequest(), context()),
    ]);
    const rejected = await getCeleryStream(userRequest(), context());

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(rejected.status).toBe(429);
    await Promise.all(responses.map((response) => (
      response.body as ReadableStream<Uint8Array>
    ).cancel()));
  });

  it('caps SSE streams across the whole Next.js process', () => {
    const releases: Array<() => void> = [];
    for (let index = 0; index < 200; index += 1) {
      const slot = acquireCeleryStream(`principal-${index}`);
      expect(slot).not.toBeInstanceOf(Response);
      releases.push(slot as () => void);
    }

    const rejected = acquireCeleryStream('principal-over-capacity');

    expect(rejected).toBeInstanceOf(Response);
    expect((rejected as Response).status).toBe(503);
    releases.forEach((release) => release());
  });

  it('fails closed when the server-only key is missing', async () => {
    delete process.env.FASTAPI_INTERNAL_API_KEY;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await getCeleryStatus(userRequest(), context());

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
