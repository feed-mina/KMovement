"use client";

// 2026-06-12 DB 기반 테마 시스템 (GitHub issue #4 Phase 3~4)
// GET /api/ui/theme/{themeId}로 design_tokens를 받아 :root CSS 변수(--kride-*)로 주입한다.
// API 실패/로딩 중에는 tokens.css의 정적 기본값이 그대로 적용되므로 화면이 깨지지 않는다(폴백).
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const DEFAULT_THEME_ID = "KRIDE_DEFAULT";

interface ThemeToken {
    category: string;
    key: string;
    value: string;
}

interface ThemeResponse {
    status: string;
    data: {
        themeId: string;
        tokens: ThemeToken[];
    } | null;
    message: string | null;
}

async function fetchTheme(themeId: string): Promise<ThemeToken[]> {
    const res = await fetch(`/api/ui/theme/${themeId}`);
    if (!res.ok) {
        throw new Error(`테마 조회 실패: ${res.status}`);
    }
    const json: ThemeResponse = await res.json();
    if (json.status !== "success" || !json.data) {
        throw new Error(json.message ?? "테마 응답이 올바르지 않습니다");
    }
    return json.data.tokens;
}

export function ThemeProvider({
    children,
    themeId = DEFAULT_THEME_ID,
}: {
    children: React.ReactNode;
    themeId?: string;
}) {
    const { data: tokens } = useQuery({
        queryKey: ["theme", themeId],
        queryFn: () => fetchTheme(themeId),
        staleTime: 1000 * 60 * 60, // 백엔드 Redis TTL(1시간)과 동일
        retry: 1, // 실패 시 tokens.css 폴백이 있으므로 과도한 재시도 불필요
    });

    useEffect(() => {
        if (!tokens) return;
        const root = document.documentElement;
        tokens.forEach(({ key, value }) => {
            root.style.setProperty(`--kride-${key}`, value);
        });
        // 테마 변경 시(다른 themeId로 재조회) 이전 인라인 값은 새 값으로 덮어써짐
    }, [tokens]);

    return <>{children}</>;
}
