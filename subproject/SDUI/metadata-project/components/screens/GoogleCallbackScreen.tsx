'use client';

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "@/services/axios";
import Skeleton from "@/components/utils/Skeleton";
import type { ScreenControllerProps } from "./types";

// 구글 캘린더 OAuth 콜백 처리 화면 컨트롤러.
export default function GoogleCallbackScreen(_props: ScreenControllerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        if (!code || !state) {
            router.replace("/view/SET_TIME_PAGE");
            return;
        }
        axios
            .get(`/api/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
            .then(() => {
                alert("구글 캘린더가 연결되었습니다.");
                router.replace("/view/SET_TIME_PAGE");
            })
            .catch(() => {
                alert("구글 캘린더 연결에 실패했습니다. 다시 시도해주세요.");
                router.replace("/view/SET_TIME_PAGE");
            });
    }, [searchParams, router]);

    return <Skeleton />;
}
