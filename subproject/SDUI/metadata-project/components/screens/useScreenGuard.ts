'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { resolveScreenAccess } from "./screenAccess";

// 등록된 접근제어 규칙에 따라 인증/권한을 강제한다.
// 반환값 blocked=true 이면 컨트롤러는 Skeleton 등으로 화면을 가려야 한다.
export function useScreenGuard(screenId: string): { isLoading: boolean; blocked: boolean } {
    const { user, isLoggedIn, isLoading } = useAuth();
    const router = useRouter();
    const access = resolveScreenAccess(screenId);

    useEffect(() => {
        if (isLoading) return;

        if (access.requireAuth && !isLoggedIn) {
            if (access.loginAlert) {
                alert("로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.");
            }
            router.replace("/view/LOGIN_PAGE");
            return;
        }

        if (access.requireRole && isLoggedIn && user?.role !== access.requireRole) {
            router.replace("/view/MAIN_PAGE");
        }
        // access는 screenId에서 파생되므로 screenId만 의존성에 둔다
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, isLoggedIn, user, screenId, router]);

    const blocked =
        (!!access.requireAuth && !isLoggedIn) ||
        (!!access.requireRole && isLoggedIn && user?.role !== access.requireRole);

    return { isLoading, blocked };
}
