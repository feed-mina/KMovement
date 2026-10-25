import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
const MAX_BODY = 10 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const allowed = new RegExp(`^(photos|photos/${UUID}|jobs|jobs/${UUID}|jobs/${UUID}/(video|retry))$`);
const reply = (detail: string, status: number) => Response.json({ detail }, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (process.env.PHOTO_VIDEO_ENABLED !== 'true') return reply('사진 영상 기능이 준비 중입니다.', 503);
  const base = process.env.PHOTO_VIDEO_URL;
  const key = process.env.PHOTO_VIDEO_INTERNAL_KEY;
  const backend = process.env.AUTH_BACKEND_URL || process.env.BACKEND_URL;
  if (!base || !key || key.length < 32 || !backend) return reply('서버 연결 설정이 필요합니다.', 503);
  const { path } = await context.params;
  const target = path.join('/');
  if (!allowed.test(target)) return reply('경로를 찾을 수 없습니다.', 404);
  if (request.method !== 'GET') {
    const expected = process.env.PHOTO_VIDEO_PUBLIC_ORIGIN;
    if (!expected || request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
      return reply('같은 사이트에서 다시 요청해주세요.', 403);
    }
  }
  try {
    const identity = await fetch(`${backend.replace(/\/$/, '')}/api/auth/me`, {
      headers: { cookie: request.headers.get('cookie') || '' },
      cache: 'no-store', signal: AbortSignal.timeout(8000), redirect: 'error',
    });
    if (!identity.ok) return reply('로그인을 확인해주세요.', identity.status >= 500 ? 503 : 401);
    const user = await identity.json();
    if (!user.isLoggedIn || !Number.isSafeInteger(user.userSqno) || user.userSqno <= 0) return reply('로그인이 필요합니다.', 401);
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (request.body && request.method !== 'GET') {
      const reader = request.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) { await reader.cancel(); return reply('파일이 너무 큽니다.', 413); }
        chunks.push(value);
      }
    }
    const page = request.nextUrl.searchParams.get('page');
    const query = target === 'jobs' && request.method === 'GET' && page && /^[1-9][0-9]{0,3}$/.test(page) ? `?page=${page}` : '';
    let body: BodyInit | undefined = request.method === 'GET' ? undefined : Buffer.concat(chunks);
    if (target === 'jobs' && request.method === 'POST') {
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reply('입력을 확인해주세요.', 422); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
          Object.keys(payload).some(key => !['photoId', 'requestId', 'courseContext', 'poiId'].includes(key))) return reply('입력을 확인해주세요.', 422);
      const normalized: Record<string, unknown> = { photoId: payload.photoId, requestId: payload.requestId };
      if (payload.courseContext || payload.poiId) {
        if (typeof payload.courseContext !== 'string' || payload.courseContext.length > 8000 || typeof payload.poiId !== 'string') return reply('코스 연결 정보를 확인해주세요.', 422);
        const ai = process.env.FASTAPI_URL || process.env.KRIDE_FASTAPI_URL;
        const token = process.env.KRIDE_INTERNAL_TOKEN;
        if (!ai || !token) return reply('코스 연결 서버를 준비 중입니다.', 503);
        const contextResponse = await fetch(`${ai.replace(/\/$/, '')}/api/public/itinerary/video-context`, {
          method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10_000), redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'X-Kride-Token': token, 'X-Kride-User': String(user.userSqno) },
          body: JSON.stringify({ courseContext: payload.courseContext, poiId: payload.poiId }),
        });
        const trip = await contextResponse.json();
        if (!contextResponse.ok) return reply(typeof trip.detail === 'string' ? trip.detail : '코스 연결 정보를 다시 확인해주세요.', contextResponse.status);
        normalized.trip = trip;
      }
      body = JSON.stringify(normalized);
    }
    const response = await fetch(`${base.replace(/\/$/, '')}/${target}${query}`, {
      method: request.method,
      headers: {
        'X-Photo-Video-Key': key, 'X-Photo-Video-Owner': String(user.userSqno),
        'Content-Type': target === 'jobs' ? 'application/json' : request.headers.get('content-type') || 'application/json',
        ...(request.headers.get('range') ? { Range: request.headers.get('range')! } : {}),
      },
      body,
      cache: 'no-store', signal: AbortSignal.timeout(30_000), redirect: 'error',
    });
    return new Response(response.body, { status: response.status, headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      ...Object.fromEntries(['content-range', 'accept-ranges', 'content-length', 'content-disposition'].flatMap(name => {
        const value = response.headers.get(name); return value ? [[name, value]] : [];
      })),
    } });
  } catch { return reply('서버에 연결하지 못했습니다. 잠시 후 다시 확인해주세요.', 503); }
}
export const GET = proxy;
export const POST = proxy;
