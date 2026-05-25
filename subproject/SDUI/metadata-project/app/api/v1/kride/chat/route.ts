import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://yerin.duckdns.org' : 'http://localhost:8080');

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const cookieHeader = request.headers.get('cookie') ?? '';

    const response = await fetch(`${BACKEND_URL}/api/v1/kride/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') ?? 'application/json',
        Cookie: cookieHeader,
      },
      body,
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? 'application/json';

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
