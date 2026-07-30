'use client';

import { usePageMetadata } from "@/components/DynamicEngine/hook/usePageMetadata";
import { usePageHook } from "@/components/DynamicEngine/hook/usePageHook";
import type { RefId } from "./types";

// 모든 화면 컨트롤러가 공유하는 배관.
// 데이터 페칭(usePageMetadata) + 폼/액션(usePageHook)을 한 번에 묶어준다.
// 도메인 특수 로직은 포함하지 않는다 — 각 컨트롤러가 결과를 조합한다.
export function useSduiScreen(
    screenId: string,
    refId: RefId,
    opts?: { isOnlyMine?: boolean; currentPage?: number; pageSize?: number }
) {
    const currentPage = opts?.currentPage ?? 1;
    const isOnlyMine = opts?.isOnlyMine ?? false;
    const pageSize = opts?.pageSize ?? 5;

    const { metadata, pageData, totalCount, loading } = usePageMetadata(
        screenId,
        currentPage,
        isOnlyMine,
        refId,
        false,
        pageSize
    );

    const {
        formData,
        setFormData,
        handleChange,
        handleAction,
        showPassword,
        pwType,
        activeModal,
        closeModal,
    } = usePageHook(screenId, metadata, pageData);

    return {
        metadata,
        pageData,
        totalCount,
        loading,
        formData,
        setFormData,
        handleChange,
        handleAction,
        showPassword,
        pwType,
        activeModal,
        closeModal,
    };
}

export type SduiScreenState = ReturnType<typeof useSduiScreen>;
