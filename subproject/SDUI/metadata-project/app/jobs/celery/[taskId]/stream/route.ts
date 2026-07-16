import { NextRequest } from 'next/server';

import {
  acquireCeleryStream,
  prepareCeleryProxyRequest,
  releaseAwareStream,
} from '../../_proxySecurity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  const prepared = await prepareCeleryProxyRequest(request, taskId, 'stream');
  if (prepared instanceof Response) return prepared;

  const streamSlot = acquireCeleryStream(prepared.principal);
  if (streamSlot instanceof Response) return streamSlot;
  const releaseStream = () => {
    request.signal.removeEventListener('abort', releaseStream);
    streamSlot();
  };
  request.signal.addEventListener('abort', releaseStream, { once: true });

  let upstream: Response;
  try {
    upstream = await fetch(
      `${prepared.fastApiUrl}/jobs/celery/${encodeURIComponent(prepared.taskId)}/stream`,
      {
        headers: {
          Accept: 'text/event-stream',
          'X-Celery-Job-Token': prepared.jobToken,
          'X-Internal-Api-Key': prepared.internalApiKey,
        },
        cache: 'no-store',
        signal: request.signal,
      },
    );
  } catch {
    releaseStream();
    return new Response(JSON.stringify({ error: 'Celery SSE upstream is unavailable.' }), {
      status: 502,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  if (!upstream.body) {
    releaseStream();
    return new Response(
      JSON.stringify({ error: 'Celery SSE upstream returned an empty response.' }),
      {
        status: upstream.status || 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }

  return new Response(releaseAwareStream(upstream.body, releaseStream), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
