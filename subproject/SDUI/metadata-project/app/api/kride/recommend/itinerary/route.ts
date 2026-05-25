import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://yerin.duckdns.org:8000";

/**
 * FastAPI /api/recommend/itinerary 프록시
 * rewrites() 대신 API Route 사용 — 타임아웃 120초로 설정
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2분

    const resp = await fetch(`${FASTAPI_URL}/api/recommend/itinerary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `FastAPI ${resp.status}`, detail: text },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        { error: "FastAPI 응답 타임아웃 (120초 초과)" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "프록시 오류" },
      { status: 502 }
    );
  }
}
