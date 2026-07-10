'use client';

import { useMemo, useState } from "react";
import Skeleton from "@/components/utils/Skeleton";
import FilterToggle from "@/components/utils/FilterToggle";
import Pagination from "@/components/fields/Pagination";
import { useScreenGuard } from "./useScreenGuard";
import { useSduiScreen } from "./useSduiScreen";
import SduiRenderer from "./SduiRenderer";
import type { ScreenControllerProps } from "./types";

// 목록 화면 컨트롤러 — "내 글만 보기" 필터 + 페이지네이션을 얹는다.
export default function ContentListScreen({ screenId, refId }: ScreenControllerProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [isOnlyMine, setIsOnlyMine] = useState(false);

    const { isLoading, blocked } = useScreenGuard(screenId);
    const s = useSduiScreen(screenId, refId, { isOnlyMine, currentPage });

    const combineData = useMemo(
        () => ({ ...s.pageData, ...s.formData }),
        [s.pageData, s.formData]
    );

    const handleToggleMine = () => {
        setIsOnlyMine((prev) => !prev);
        setCurrentPage(1);
    };

    if (isLoading || blocked) return <Skeleton />;

    return (
        <div className={`page-wrap ${screenId}`}>
            <FilterToggle isOnlyMine={isOnlyMine} onToggle={handleToggleMine} />
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
            <Pagination
                totalCount={s.totalCount}
                pageSize={5}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
            />
        </div>
    );
}
