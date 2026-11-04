import {NextRequest, NextResponse} from 'next/server';
import {fetchPublicImageSource, pageImageChoices} from '@/lib/kpop/remoteProductImage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const attempts = new Map<string, {count: number; until: number}>();
const headers = {'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff'};

export async function POST(req: NextRequest) {
    if (req.headers.get('origin') !== req.nextUrl.origin)
        return NextResponse.json({message: '현재 상품 화면에서 다시 시도해 주세요.'}, {status: 403, headers});
    try {
        const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
            || (process.env.NODE_ENV === 'production' ? 'https://yerin.duckdns.org' : 'http://localhost:8080');
        const auth = await fetch(new URL('/api/auth/me', backend), {
            headers: {cookie: req.headers.get('cookie') || ''}, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
        });
        if (!auth.ok) return NextResponse.json({message: '로그인 후 사진 주소를 불러올 수 있어요.'}, {status: auth.status === 401 || auth.status === 403 ? 401 : 503, headers});
        const principal = await auth.json();
        const user = principal.data ?? principal;
        const id = user.isLoggedIn === true ? String(user.userSqno || user.userId || '') : '';
        if (!id) return NextResponse.json({message: '로그인을 다시 확인해 주세요.'}, {status: 401, headers});
        const now = Date.now();
        for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
        const window = attempts.get(id) || {count: 0, until: now + 60_000};
        if (window.count >= 12 || (!attempts.has(id) && attempts.size >= 1000))
            return NextResponse.json({message: '주소를 여러 번 확인했어요. 잠시 후 다시 시도해 주세요.'}, {status: 429, headers: {...headers, 'Retry-After': '60'}});
        window.count++; attempts.set(id, window);
        if (Number(req.headers.get('content-length') || 0) > 4096) throw new Error('request_too_large');
        const reader = req.body?.getReader(); if (!reader) throw new Error('empty_request');
        const chunks: Uint8Array[] = []; let size = 0;
        try {
            for (;;) {
                const part = await reader.read(); if (part.done) break;
                size += part.value.byteLength;
                if (size > 4096) {await reader.cancel(); throw new Error('request_too_large');}
                chunks.push(part.value);
            }
        } finally {reader.releaseLock();}
        const text = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(text);
        if (typeof payload.url !== 'string') throw new Error('invalid_url');
        const source = await fetchPublicImageSource(payload.url);
        if (source.type === 'text/html') {
            const images = pageImageChoices(source.body.toString('utf8'), source.url);
            if (!images.length) throw new Error('no_images');
            return NextResponse.json({images}, {headers});
        }
        return new NextResponse(new Uint8Array(source.body), {headers: {...headers, 'Content-Type': source.type}});
    } catch {
        return NextResponse.json({message: '이 주소의 사진을 가져올 수 없어요. 공개된 이미지 주소를 확인하거나 사진을 직접 올려 주세요.'}, {status: 422, headers});
    }
}
