import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const backend = process.env.AUTH_BACKEND_URL || process.env.BACKEND_URL
    || (process.env.NODE_ENV !== 'production' ? 'http://localhost:8080' : '');
  if (!backend) return NextResponse.json({ message: '프로필 서버를 준비 중입니다.' }, { status: 503 });
  try {
    // 요청 바디 읽기
    const body = await request.json();
    // console.log('[update-profile API Route] Request body:', JSON.stringify(body));

    // 쿠키 헤더 가져오기
    const cookieHeader = request.headers.get('cookie');
    // console.log('[update-profile API Route] Cookie header:', cookieHeader ? 'Present' : 'Missing');

    // 백엔드로 프록시 요청
    // console.log('[update-profile API Route] Sending to backend:', `${BACKEND_URL}/api/auth/update-profile`);
    const response = await fetch(`${backend.replace(/\/$/, '')}/api/auth/update-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader || '',
      },
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    // console.log('[update-profile API Route] Backend response status:', response.status);

    // 백엔드 응답 읽기
    const responseText = await response.text();
    // console.log('[update-profile API Route] Backend response text:', responseText);

    // JSON 파싱 시도
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      // console.error('[update-profile API Route] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON from backend', responseText },
        { status: 500 }
      );
    }

    // Set-Cookie 헤더를 클라이언트로 전달
    const setCookieHeaders = response.headers.get('set-cookie');
    const nextResponse = NextResponse.json(data, { status: response.status });

    if (setCookieHeaders) {
      nextResponse.headers.set('set-cookie', setCookieHeaders);
    }

    return nextResponse;
  } catch (error: any) {
    // console.error('[update-profile API Route] Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
