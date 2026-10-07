import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const base = process.env.FASTAPI_URL ?? process.env.KRIDE_FASTAPI_URL;
  const auth = process.env.AUTH_BACKEND_URL ?? process.env.BACKEND_URL;
  const token = process.env.KRIDE_INTERNAL_TOKEN;
  const reply = (status: number) => Response.json({ error: '답변 연결을 확인해 주세요.' },
    { status, headers: { 'Cache-Control': 'private, no-store' } });
  const origin = request.headers.get('origin');
  const configuredOrigin = process.env.KRIDE_SITE_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL;
  let expectedOrigin: string;
  try { expectedOrigin = new URL(configuredOrigin ?? request.url).origin; } catch { return reply(503); }
  if (origin && origin !== expectedOrigin) return reply(403);
  if (!base || !auth || !token) return reply(503);
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) abort();
  const timer = setTimeout(abort, 110000);
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', abort); };
  let handedOff = false;
  try {
    const identity = await fetch(`${auth}/api/auth/me`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), cache: 'no-store',
    });
    if (!identity.ok) return reply(identity.status >= 500 ? 503 : 401);
    const user = await identity.json();
    if (!user.isLoggedIn || !Number.isSafeInteger(user.userSqno) || user.userSqno <= 0) return reply(401);
    const text = await request.text();
    if (text.length > 16000) return reply(413);
    let body;
    try { body = JSON.parse(text); } catch { return reply(400); }
    if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 4000) return reply(422);
    if (body.language !== undefined && !['en','ja','ko'].includes(body.language)) return reply(422);
    if (body.responseLocale !== undefined && !['en','ja','ko'].includes(body.responseLocale)) return reply(422);
    if (body.courseContext !== undefined && (typeof body.courseContext !== 'string' || body.courseContext.length > 8000)) return reply(422);
    const upstream = await fetch(`${base}/api/public/chat/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        'X-Kride-Token': token, 'X-Kride-User': String(user.userSqno) },
      body: JSON.stringify({ message: body.message, ...(body.language ? {language:body.language} : {}), ...(body.responseLocale ? {responseLocale:body.responseLocale} : {}), ...(body.courseContext ? {courseContext:body.courseContext} : {}) }), signal: controller.signal, cache: 'no-store',
    });
    if (!upstream.ok) { await upstream.body?.cancel(); return reply(upstream.status); }
    if (!upstream.body || !upstream.headers.get('content-type')?.includes('text/event-stream')) {
      await upstream.body?.cancel(); return reply(502);
    }
    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(destination) {
        try {
          const { value, done } = await reader.read();
          if (done) { cleanup(); reader.releaseLock(); destination.close(); }
          else destination.enqueue(value);
        } catch (error) { cleanup(); abort(); reader.releaseLock(); destination.error(error); }
      },
      async cancel() {
        abort(); cleanup();
        try { await reader.cancel(); } finally { reader.releaseLock(); }
      },
    });
    handedOff = true;
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no' } });
  } catch { return reply(controller.signal.aborted ? 504 : 502); }
  finally { if (!handedOff) { cleanup(); abort(); } }
}
