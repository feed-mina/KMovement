'use client';

import { useMemo, useState } from "react";
import Skeleton from "@/components/utils/Skeleton";
import { useScreenGuard } from "./useScreenGuard";
import { useSduiScreen } from "./useSduiScreen";
import SduiRenderer from "./SduiRenderer";
import type { ScreenControllerProps } from "./types";
import Pagination from "@/components/fields/Pagination";

// 기본 화면 컨트롤러 — 도메인 특수 로직 없이 메타데이터를 그대로 렌더한다.
// 레지스트리에서 매칭되는 컨트롤러가 없을 때 사용된다.
export default function SduiScreen({ screenId, refId }: ScreenControllerProps) {
    const { isLoading, blocked } = useScreenGuard(screenId);
    const isKpopExplore = screenId === 'KPOP_EXPLORE';
    const [currentPage, setCurrentPage] = useState(1);
    const s = useSduiScreen(screenId, refId, isKpopExplore ? { currentPage, pageSize: 8 } : undefined);

    const combineData = useMemo(
        () => ({ ...s.pageData, ...s.formData }),
        [s.pageData, s.formData]
    );

    if (isLoading || blocked) return <Skeleton />;

    return (
        <div className={`page-wrap ${screenId}`}>
            <SduiRenderer
                screenId={screenId}
                metadata={s.metadata}
                pageData={combineData}
                formData={s.formData}
                setFormData={s.setFormData}
                onChange={s.handleChange}
                onAction={s.handleAction}
                pwType={s.pwType}
                showPassword={s.showPassword}
                activeModal={s.activeModal}
                closeModal={s.closeModal}
            />
            {isKpopExplore && (
                <Pagination
                    totalCount={s.totalCount}
                    pageSize={8}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            )}
        </div>
    );
}
