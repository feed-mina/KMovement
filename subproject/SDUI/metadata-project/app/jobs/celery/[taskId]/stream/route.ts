import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

function proxyConfig() {
  const fastApiUrl = process.env.FASTAPI_URL ?? process.env.KRIDE_FASTAPI_URL;
  const internalApiKey = process.env.FASTAPI_INTERNAL_API_KEY;
  return { fastApiUrl: fastApiUrl?.replace(/\/$/, ''), internalApiKey };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { fastApiUrl, internalApiKey } = proxyConfig();
  if (!fastApiUrl || !internalApiKey) {
    return new Response(JSON.stringify({ error: 'Celery proxy is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const { taskId } = await context.params;
  const upstream = await fetch(
    `${fastApiUrl}/jobs/celery/${encodeURIComponent(taskId)}/stream`,
    {
      headers: {
        Accept: 'text/event-stream',
        'X-Internal-Api-Key': internalApiKey,
      },
      cache: 'no-store',
      signal: request.signal,
    },
  );

  if (!upstream.body) {
    return new Response(
      JSON.stringify({ error: 'Celery SSE upstream returned an empty response.' }),
      {
        status: upstream.status || 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
