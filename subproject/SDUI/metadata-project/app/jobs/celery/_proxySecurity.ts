import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NextRequest } from 'next/server';


const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_WINDOW_MS = 60_000;
const STATUS_REQUEST_LIMIT = 60;
const STREAM_REQUEST_LIMIT = 10;
const CONCURRENT_STREAM_LIMIT = 3;
const PROCESS_STREAM_LIMIT = 200;

interface RateWindow {
  count: number;
  resetAt: number;
}

export interface CeleryProxyRequest {
  fastApiUrl: string;
  internalApiKey: string;
  jobToken: string;
  principal: string;
  taskId: string;
}

type RequestKind = 'status' | 'stream';

const rateWindows = new Map<string, RateWindow>();
const activeStreams = new Map<string, number>();
let totalActiveStreams = 0;

function jsonError(error: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function proxyConfig() {
  const fastApiUrl = process.env.FASTAPI_URL ?? process.env.KRIDE_FASTAPI_URL;
  const backendUrl = process.env.BACKEND_URL
    ?? process.env.NEXT_PUBLIC_BACKEND_URL
    ?? (process.env.NODE_ENV === 'production' ? 'http://sdui-backend:8080' : 'http://localhost:8080');
  const internalApiKey = process.env.FASTAPI_INTERNAL_API_KEY?.trim();
  return {
    backendUrl: backendUrl.replace(/\/$/, ''),
    fastApiUrl: fastApiUrl?.replace(/\/$/, ''),
    internalApiKey,
  };
}

function constantTimeEqual(left: string | null, right: string): boolean {
  if (!left) return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function clientAddress(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',').at(-1)?.trim() || 'unknown';
}

function celeryJobToken(taskId: string, internalApiKey: string): string {
  return createHmac('sha256', internalApiKey).update(taskId).digest('hex');
}

function enforceRateLimit(principal: string, kind: RequestKind): Response | null {
  const now = Date.now();
  if (rateWindows.size > 1024) {
    for (const [existingKey, existingWindow] of rateWindows) {
      if (existingWindow.resetAt <= now) rateWindows.delete(existingKey);
    }
    // A proxy/header misconfiguration must not turn unique client keys into an
    // unbounded process-lifetime allocation.
    while (rateWindows.size >= 4096) {
      const oldestKey = rateWindows.keys().next().value as string | undefined;
      if (!oldestKey) break;
      rateWindows.delete(oldestKey);
    }
  }
  const key = `${kind}:${principal}`;
  const limit = kind === 'stream' ? STREAM_REQUEST_LIMIT : STATUS_REQUEST_LIMIT;
  let window = rateWindows.get(key);

  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateWindows.set(key, window);
  }

  window.count += 1;
  if (window.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
  return jsonError('Too many Celery job requests.', 429, {
    'Retry-After': String(retryAfterSeconds),
  });
}

async function verifyOwnership(
  request: NextRequest,
  backendUrl: string,
  taskId: string,
): Promise<Response | null> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');
  if (cookie) headers.Cookie = cookie;
  if (authorization) headers.Authorization = authorization;

  const ownershipAbort = new AbortController();
  const ownershipTimeout = setTimeout(() => ownershipAbort.abort(), 5_000);
  const abortOwnership = () => ownershipAbort.abort();
  if (request.signal.aborted) abortOwnership();
  else request.signal.addEventListener('abort', abortOwnership, { once: true });

  let response: Response;
  try {
    response = await fetch(
      `${backendUrl}/api/v1/celery/jobs/${encodeURIComponent(taskId)}/ownership`,
      {
        headers,
        cache: 'no-store',
        signal: ownershipAbort.signal,
      },
    );
  } catch {
    return jsonError('Celery ownership service is unavailable.', 503);
  } finally {
    clearTimeout(ownershipTimeout);
    request.signal.removeEventListener('abort', abortOwnership);
  }

  // Drain the preflight response so the backend connection can be reused.
  await response.arrayBuffer().catch(() => undefined);

  if (response.ok) return null;
  if (response.status === 401 || response.status === 403) {
    return jsonError('Authentication is required.', 401);
  }
  if (response.status === 404) {
    // Do not reveal whether another user owns the task.
    return jsonError('Celery job was not found.', 404);
  }
  return jsonError('Celery ownership service is unavailable.', 503);
}

export async function prepareCeleryProxyRequest(
  request: NextRequest,
  rawTaskId: string,
  kind: RequestKind,
): Promise<CeleryProxyRequest | Response> {
  const { backendUrl, fastApiUrl, internalApiKey } = proxyConfig();
  if (!fastApiUrl || !internalApiKey) {
    return jsonError('Celery proxy is not configured.', 503);
  }
  if (!TASK_ID_PATTERN.test(rawTaskId)) {
    return jsonError('Invalid Celery task ID.', 400);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return jsonError('Cross-site Celery requests are not allowed.', 403);
  }

  const isInternalSmoke = constantTimeEqual(
    request.headers.get('x-internal-api-key'),
    internalApiKey,
  );
  const hasCredential = Boolean(
    request.headers.get('authorization') || request.headers.get('cookie'),
  );
  if (!isInternalSmoke && !hasCredential) {
    return jsonError('Authentication is required.', 401);
  }

  // Nginx overwrites X-Real-IP and appends the actual peer to X-Forwarded-For.
  // IP-based keys are bounded independently of attacker-controlled cookie text.
  const principal = `${isInternalSmoke ? 'internal' : 'user'}:${clientAddress(request)}`;

  const rateLimitResponse = enforceRateLimit(principal, kind);
  if (rateLimitResponse) return rateLimitResponse;

  if (!isInternalSmoke) {
    const ownershipResponse = await verifyOwnership(request, backendUrl, rawTaskId);
    if (ownershipResponse) return ownershipResponse;
  }

  return {
    fastApiUrl,
    internalApiKey,
    jobToken: celeryJobToken(rawTaskId, internalApiKey),
    principal,
    taskId: rawTaskId,
  };
}

export function acquireCeleryStream(principal: string): (() => void) | Response {
  if (totalActiveStreams >= PROCESS_STREAM_LIMIT) {
    return jsonError('Celery stream capacity is exhausted.', 503, { 'Retry-After': '5' });
  }
  const current = activeStreams.get(principal) ?? 0;
  if (current >= CONCURRENT_STREAM_LIMIT) {
    return jsonError('Too many concurrent Celery streams.', 429, { 'Retry-After': '1' });
  }
  activeStreams.set(principal, current + 1);
  totalActiveStreams += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    totalActiveStreams = Math.max(0, totalActiveStreams - 1);
    const remaining = (activeStreams.get(principal) ?? 1) - 1;
    if (remaining <= 0) activeStreams.delete(principal);
    else activeStreams.set(principal, remaining);
  };
}

export function releaseAwareStream(
  upstream: ReadableStream<Uint8Array>,
  release: () => void,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        release();
      }
    },
  });
}

export function resetCeleryProxySecurityForTests(): void {
  rateWindows.clear();
  activeStreams.clear();
  totalActiveStreams = 0;
}
