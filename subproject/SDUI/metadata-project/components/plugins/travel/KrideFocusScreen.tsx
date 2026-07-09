'use client';

import { useEffect, useMemo, useState } from "react";
import Skeleton from "@/components/utils/Skeleton";
import { useScreenGuard } from "@/components/screens/useScreenGuard";
import { useSduiScreen } from "@/components/screens/useSduiScreen";
import SduiRenderer from "@/components/screens/SduiRenderer";
import type { ScreenControllerProps } from "@/components/screens/types";
import { useKrideItinerary } from "@/components/DynamicEngine/hook/useKrideItinerary";
import { KrideButton, RaiStatePanel } from "@/components/fields/kride/atoms/KridePrimitives";
import KrideChatComponent from "@/components/fields/kride/chat/KrideChatComponent";

// KRIDE_FOCUS 화면 컨트롤러 (여행 플러그인).
// AI 일정 추천 훅, 챗봇 실시간 반영, 상태 패널, 플로팅 챗 모달을 담당한다.
// 코어 라우터(page.tsx)에서 이 로직을 걷어내기 위한 격리 지점이다.
export default function KrideFocusScreen({ screenId, refId }: ScreenControllerProps) {
    const { isLoading, blocked } = useScreenGuard(screenId);
    const s = useSduiScreen(screenId, refId);
    const krideItinerary = useKrideItinerary(screenId, s.formData);

    // FOCUS 진입 시 챗 모달 기본 오픈
    const [isChatModalOpen, setIsChatModalOpen] = useState(true);

    // AI 챗봇이 생성한 일정/장소를 지도·패널에 실시간 반영
    useEffect(() => {
        const handleChatUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail) return;
            s.setFormData((prev: any) => {
                const next = { ...prev };
                if (detail.itinerary) next.itinerary = detail.itinerary;
                if (detail.pois) next.pois = detail.pois;
                if (detail.sourcePois) next.source_pois = detail.sourcePois;
                const markers =
                    detail.markers ?? detail.pois ?? detail.mapData?.markers ?? detail.itinerary?.mapData?.markers;

                if (markers) {
                    next.markers = markers;
                    next.mapData = {
                        ...next.mapData,
                        ...detail.mapData,
                        markers,
                        itinerary: detail.itinerary ?? detail.mapData?.itinerary ?? next.itinerary,
                    };
                }

                try {
                    localStorage.setItem("kride_form", JSON.stringify(next));
                } catch {}

                return next;
            });
        };

        window.addEventListener("kride-chat-update", handleChatUpdate);
        return () => window.removeEventListener("kride-chat-update", handleChatUpdate);
    }, [s.setFormData]);

    // AI 일정 추천 결과를 formData에 동기화
    useEffect(() => {
        if (krideItinerary.data) {
            s.setFormData((prev: any) => ({
                ...prev,
                itinerary: krideItinerary.data?.itinerary,
                markers: krideItinerary.data?.mapData?.markers,
                mapData: krideItinerary.data?.mapData,
            }));
        }
    }, [krideItinerary.data, s.setFormData]);

    const combineData = useMemo(
        () => ({ ...s.pageData, ...krideItinerary.data, ...s.formData }),
        [s.pageData, krideItinerary.data, s.formData]
    );

    // 챗 모달 열기 액션 가로채기
    const handleAction = async (meta: any, data?: any) => {
        const actionUrl = meta?.actionUrl || meta?.action_url;
        if (actionUrl === "/view/CHAT" || actionUrl === "/view/KRIDE_CHAT") {
            setIsChatModalOpen((prev) => !prev);
            return;
        }
        return s.handleAction(meta, data);
    };

    if (isLoading || blocked) return <Skeleton />;

    if (krideItinerary.isLoading) {
        return (
            <div className="page-wrap KRIDE_FOCUS kride-focus-state-page">
                <RaiStatePanel
                    state="thinking"
                    eyebrow="K-RIDE AI"
                    title="라이가 여행 코스를 그리고 있어요"
                    description="잠시만 기다려 주세요."
                />
            </div>
        );
    }

    if (krideItinerary.error) {
        return (
            <div className="page-wrap KRIDE_FOCUS kride-focus-state-page">
                <RaiStatePanel
                    state="sad"
                    eyebrow="K-RIDE AI"
                    title="코스를 못 찾았어요"
                    description={krideItinerary.error}
                >
                    <KrideButton onClick={() => window.location.reload()}>다시 시도</KrideButton>
                </RaiStatePanel>
            </div>
        );
    }

    return (
        <div className={`page-wrap ${screenId}`}>
            <SduiRenderer
                screenId={screenId}
                metadata={s.metadata}
                pageData={combineData}
                formData={s.formData}
                setFormData={s.setFormData}
                onChange={s.handleChange}
                onAction={handleAction}
                pwType={s.pwType}
                showPassword={s.showPassword}
                activeModal={s.activeModal}
                closeModal={s.closeModal}
            />

            {isChatModalOpen && (
                <div className="kride-focus-chat-modal">
                    <KrideChatComponent
                        meta={{ labelText: "K-RIDE 여행봇", cssClass: "h-full w-full" }}
                        data={{}}
                        onCloseModal={() => setIsChatModalOpen(false)}
                    />
                </div>
            )}
        </div>
    );
}
