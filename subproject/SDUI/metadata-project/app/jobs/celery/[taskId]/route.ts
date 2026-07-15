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

export async function GET(_request: NextRequest, context: RouteContext) {
  const { fastApiUrl, internalApiKey } = proxyConfig();
  if (!fastApiUrl || !internalApiKey) {
    return new Response(JSON.stringify({ error: 'Celery proxy is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const { taskId } = await context.params;
  const upstream = await fetch(`${fastApiUrl}/jobs/celery/${encodeURIComponent(taskId)}`, {
    headers: { 'X-Internal-Api-Key': internalApiKey },
    cache: 'no-store',
  });
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
