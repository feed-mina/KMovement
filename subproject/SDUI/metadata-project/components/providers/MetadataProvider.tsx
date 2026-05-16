'use client';

import React, {createContext, useContext, useMemo, ReactNode, useState, useEffect} from "react";
import { usePathname, useParams } from 'next/navigation'; // @@@@ useParams 추가됨
import { DEFAULT_SCREEN_ID, SCREEN_MAP } from '@/components/constants/screenMap';
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

interface MetadataContextType {
    menuTree: any[];
    isLoading: boolean;
    screenId: string;
    refId: string | number | null;
}

const MetadataContext = createContext<MetadataContextType | undefined>(undefined);

interface MetadataProviderProps {
    children: ReactNode;
    screenId?: string; // 테스트용 주입 prop
}

export function MetadataProvider({ children, screenId: propScreenId }: MetadataProviderProps) {

    const { user } = useAuth();
    const pathname = usePathname();

    // 1. 최종 screenId 결정 로직 통합
    const finalScreenId = useMemo(() => {
        // 우선순위: 1. 직접 넘겨준 ID -> 2. URL 매핑 테이블 -> 3. URL 파라미터 -> 4. 초기화 값
        if (propScreenId) return propScreenId;

        const pathSegments = pathname.split('/').filter(Boolean);
        const viewIndex = pathSegments.indexOf('view');
        //  * 경로가 /view/[screenId]/[index] 또는 /view/admin/[screenId]/[index] 인 경우
        if (viewIndex !== -1 && pathSegments[viewIndex + 1]) {
            if (pathSegments[viewIndex + 1] === 'admin') {
                const rawId = pathSegments[viewIndex + 2] || DEFAULT_SCREEN_ID;
                return SCREEN_MAP[`/${rawId}`] || rawId;
            }
            const rawId = pathSegments[viewIndex + 1];
            return SCREEN_MAP[`/${rawId}`] || rawId;
        }
        // * 경로가 meta.screen_id로 URL 또는 MAIN_PAGE
        return SCREEN_MAP[pathname] || DEFAULT_SCREEN_ID;
    }, [propScreenId, pathname]);

    // 2. 권한 정보 조합
    //  * RBAC 유저 권한에 따라 볼수 있는 페이지가 다르다
    //  * user.role이 없으면 서버가 로그인 시 설정한 non-HttpOnly 'role' 쿠키를 fallback으로 사용
    const getRoleFromCookie = (): string => {
        if (typeof document === 'undefined') return 'GUEST';
        const match = document.cookie.match(/(?:^|;\s*)role=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : 'GUEST';
    };
    const rolePrefix = (user?.role || getRoleFromCookie()).replace('ROLE_', '');
    const dynamicQueryKey = `${rolePrefix}_${finalScreenId}`;

    // 3. 데이터 페칭
    //  * QueryProvider에서 reactQuery를 사용하여 서버와 통신
    const { data, isLoading } = useQuery({
        // * queryKey는 메타데이터와 dynamicQueryKey : ${유저구분키}_${URL파라미터} 이다.
        queryKey: ['metadata', dynamicQueryKey],
        queryFn: async () => {
            const res = await fetch(`/api/ui/${finalScreenId}`);
            if (!res.ok) throw new Error('네트워크 연결이 올바르지 않습니다');
            //  * result는 서버에서 받아온 screenId의 메타데이터값이다.  (data, success) 형식
            const result = await res.json();
            return result.data || [];
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!finalScreenId, // * 최종 URL 파라미터 가 확정되었을 때만 실행
    });
    const params = useParams();
    const slug = (params?.slug as string[]) || [];
    //   Context Value를 메모이제이션하여 참조값 고정
    //  * data : 서버에서 가져온 screenId별 메타데이터 정보 , 레이아웃크기구분, 로딩상태, 최종 URL파라미터를 contextValue의 변수에 담아 케싱한다
    const contextValue = useMemo(() => {
        // URL 기반으로 정보 추출 (/view/admin/[screenId] 패턴 지원)
        const isAdminPath = slug[0] === 'admin';
        const screenIdFromUrl = isAdminPath
            ? (slug[1] || SCREEN_MAP[pathname] || DEFAULT_SCREEN_ID)
            : (slug[0] || SCREEN_MAP[pathname] || DEFAULT_SCREEN_ID);
        const refRaw = isAdminPath ? slug[2] : slug[1];
        let refIdFromUrl: string | number | null = null;
        if (refRaw) {
            refIdFromUrl = !isNaN(Number(refRaw)) ? Number(refRaw) : refRaw;
        }
        return {
            menuTree: data || [],
            isLoading,
            screenId: finalScreenId,
            refId: refIdFromUrl
        };
    }, [data, isLoading, slug, pathname, finalScreenId]);

    return (
        <MetadataContext.Provider value={contextValue}>
            {children}
        </MetadataContext.Provider>
    );
}

export const useMetadata = () => {
    const context = useContext(MetadataContext);
    if (!context) throw new Error("useMetadata는 MetadataProvider 안에서 사용되어야 합니다.");
    return context;
};