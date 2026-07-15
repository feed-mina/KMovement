'use client';

import { useEffect, useMemo, useState } from 'react';

export interface CeleryJobMeta {
  step?: string;
  progress?: number;
  [key: string]: unknown;
}

export interface CeleryJobSnapshot<TResult = unknown> {
  ok: boolean;
  task_id: string;
  status: string;
  celery_status?: string;
  meta?: CeleryJobMeta;
  result?: TResult;
  error?: string;
}

export interface UseCeleryJobStreamOptions {
  baseUrl?: string;
  enabled?: boolean;
  /** Direct FastAPI calls only. Production browsers should use the same-origin Next.js proxy. */
  internalApiKey?: string;
  fallbackToPolling?: boolean;
  pollingIntervalMs?: number;
  credentials?: RequestCredentials;
}

export interface UseCeleryJobStreamResult<TResult = unknown> {
  job: CeleryJobSnapshot<TResult> | null;
  status: string;
  meta: CeleryJobMeta | null;
  progress: number;
  result: TResult | null;
  error: string | null;
  isConnected: boolean;
  isComplete: boolean;
  usingPolling: boolean;
}

const TERMINAL_STATES = new Set(['SUCCESS', 'FAILURE', 'REVOKED']);

function isTerminal(snapshot: CeleryJobSnapshot | null): boolean {
  if (!snapshot) return false;
  return TERMINAL_STATES.has(snapshot.celery_status ?? snapshot.status);
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Parse `data:` frames until `[DONE]`; heartbeat/comment frames are ignored. */
export async function consumeCeleryJobStream<TResult>(
  response: Response,
  signal: AbortSignal,
  onSnapshot: (snapshot: CeleryJobSnapshot<TResult>) => void,
): Promise<boolean> {
  if (!response.ok) throw new Error(`Celery SSE failed: ${response.status}`);
  if (!response.body) throw new Error('Celery SSE response body is empty.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const consumeEvent = (event: string): boolean => {
    const raw = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!raw) return false;
    if (raw === '[DONE]' || raw === '"[DONE]"') return true;

    const parsed = JSON.parse(raw) as CeleryJobSnapshot<TResult>;
    onSnapshot(parsed);
    return false;
  };

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      for (const event of events) {
        if (consumeEvent(event)) {
          await reader.cancel().catch(() => undefined);
          return true;
        }
      }
    }

    buffer += decoder.decode();
    return buffer.trim() ? consumeEvent(buffer) : false;
  } finally {
    if (signal.aborted) {
      await reader.cancel().catch(() => undefined);
    }
  }
}

export function useCeleryJobStream<TResult = unknown>(
  taskId: string | null | undefined,
  options: UseCeleryJobStreamOptions = {},
): UseCeleryJobStreamResult<TResult> {
  const {
    baseUrl = '',
    enabled = true,
    internalApiKey,
    fallbackToPolling = true,
    pollingIntervalMs = 2000,
    credentials = 'include',
  } = options;
  const [job, setJob] = useState<CeleryJobSnapshot<TResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [usingPolling, setUsingPolling] = useState(false);

  useEffect(() => {
    setJob(null);
    setError(null);
    setIsConnected(false);
    setUsingPolling(false);

    if (!taskId || !enabled) return undefined;

    const controller = new AbortController();
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const encodedTaskId = encodeURIComponent(taskId);
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (internalApiKey) headers['X-Internal-Api-Key'] = internalApiKey;

    let latest: CeleryJobSnapshot<TResult> | null = null;
    const applySnapshot = (snapshot: CeleryJobSnapshot<TResult>) => {
      if (controller.signal.aborted) return;
      latest = snapshot;
      setJob(snapshot);
      if ((snapshot.celery_status ?? snapshot.status) === 'FAILURE' || snapshot.status === 'REVOKED') {
        setError(snapshot.error ?? 'Celery job failed.');
      }
    };

    const pollUntilComplete = async () => {
      setUsingPolling(true);
      setIsConnected(false);
      setError(null);
      while (!controller.signal.aborted) {
        const response = await fetch(`${normalizedBaseUrl}/jobs/celery/${encodedTaskId}`, {
          credentials,
          headers: internalApiKey ? { 'X-Internal-Api-Key': internalApiKey } : undefined,
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Celery status failed: ${response.status}`);
        const snapshot = (await response.json()) as CeleryJobSnapshot<TResult>;
        applySnapshot(snapshot);
        if (isTerminal(snapshot)) return;
        await abortableDelay(Math.max(pollingIntervalMs, 250), controller.signal);
      }
    };

    const run = async () => {
      try {
        const response = await fetch(`${normalizedBaseUrl}/jobs/celery/${encodedTaskId}/stream`, {
          credentials,
          headers,
          cache: 'no-store',
          signal: controller.signal,
        });
        setIsConnected(true);
        await consumeCeleryJobStream(response, controller.signal, applySnapshot);
        setIsConnected(false);
        if (controller.signal.aborted || isTerminal(latest)) return;
        if (!fallbackToPolling) throw new Error('Celery SSE ended before the job completed.');
      } catch (streamError) {
        setIsConnected(false);
        if (controller.signal.aborted) return;
        if (!fallbackToPolling) throw streamError;
      }

      await pollUntilComplete();
    };

    void run().catch((caught: unknown) => {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Celery job stream failed.');
      setIsConnected(false);
    });

    return () => controller.abort();
  }, [
    baseUrl,
    credentials,
    enabled,
    fallbackToPolling,
    internalApiKey,
    pollingIntervalMs,
    taskId,
  ]);

  return useMemo(() => ({
    job,
    status: job?.status ?? (error ? 'ERROR' : taskId && enabled ? 'CONNECTING' : 'IDLE'),
    meta: job?.meta ?? null,
    progress: job?.meta?.progress ?? (job?.status === 'SUCCESS' ? 100 : 0),
    result: job?.result === undefined ? null : job.result,
    error,
    isConnected,
    isComplete: isTerminal(job),
    usingPolling,
  }), [enabled, error, isConnected, job, taskId, usingPolling]);
}
