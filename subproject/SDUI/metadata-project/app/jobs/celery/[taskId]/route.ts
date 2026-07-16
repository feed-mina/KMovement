import { NextRequest } from 'next/server';

import { prepareCeleryProxyRequest } from '../_proxySecurity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  const prepared = await prepareCeleryProxyRequest(request, taskId, 'status');
  if (prepared instanceof Response) return prepared;

  let upstream: Response;
  try {
    upstream = await fetch(
      `${prepared.fastApiUrl}/jobs/celery/${encodeURIComponent(prepared.taskId)}`,
      {
        headers: {
          'X-Celery-Job-Token': prepared.jobToken,
          'X-Internal-Api-Key': prepared.internalApiKey,
        },
        cache: 'no-store',
        signal: request.signal,
      },
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Celery status upstream is unavailable.' }), {
      status: 502,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
