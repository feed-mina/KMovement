'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "@/components/utils/Skeleton";
import { useScreenGuard } from "@/components/screens/useScreenGuard";
import { useSduiScreen } from "@/components/screens/useSduiScreen";
import SduiRenderer from "@/components/screens/SduiRenderer";
import type { ScreenControllerProps } from "@/components/screens/types";
import { useKrideItinerary } from "@/components/DynamicEngine/hook/useKrideItinerary";
import { KrideButton, RaiStatePanel } from "@/components/fields/kride/atoms/KridePrimitives";
import KrideChatComponent from "@/components/fields/kride/chat/KrideChatComponent";
import { preferNonEmptyMarkers } from "@/components/fields/kride/maps/normalizeRouteMapData";
import ItineraryLoadingPanel from "@/components/fields/kride/ItineraryLoadingPanel";

// KRIDE_FOCUS 화면 컨트롤러 (여행 플러그인).
// AI 일정 추천 훅, 챗봇 실시간 반영, 상태 패널, 플로팅 챗 모달을 담당한다.
// 코어 라우터(page.tsx)에서 이 로직을 걷어내기 위한 격리 지점이다.
export default function KrideFocusScreen({ screenId, refId }: ScreenControllerProps) {
    const { isLoading, blocked } = useScreenGuard(screenId);
    const s = useSduiScreen(screenId, refId);
    const krideItinerary = useKrideItinerary(screenId, s.formData);

    // FOCUS 진입 시 챗 모달 기본 오픈
    const [isChatModalOpen, setIsChatModalOpen] = useState(true);
    const chatDialogRef = useRef<HTMLDivElement>(null);
    const chatOpenerRef = useRef<HTMLElement | null>(null);

    const closeChatModal = useCallback(() => {
        setIsChatModalOpen(false);
        chatOpenerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!isChatModalOpen) return;

        const dialog = chatDialogRef.current;
        if (!dialog) return;

        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && !dialog.contains(activeElement)) {
            chatOpenerRef.current = activeElement;
        }

        const getFocusableElements = () =>
            Array.from(
                dialog.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            );

        getFocusableElements()[0]?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeChatModal();
                return;
            }

            if (event.key !== "Tab") return;
            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [closeChatModal, isChatModalOpen]);

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
                const incomingMarkers =
                    detail.markers ?? detail.pois ?? detail.mapData?.markers ?? detail.itinerary?.mapData?.markers;
                const existingMarkers = next.mapData?.markers ?? next.markers ?? [];
                const markers = preferNonEmptyMarkers(incomingMarkers, existingMarkers);

                if (Array.isArray(markers)) {
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
            s.setFormData((prev: any) => {
                const incomingMarkers = krideItinerary.data?.mapData?.markers ?? [];
                const existingMarkers = prev?.mapData?.markers ?? prev?.markers ?? [];
                const markers = preferNonEmptyMarkers(incomingMarkers, existingMarkers);
                return {
                    ...prev,
                    itinerary: krideItinerary.data?.itinerary,
                    markers,
                    mapData: {
                        ...prev?.mapData,
                        ...krideItinerary.data?.mapData,
                        markers,
                        itinerary: krideItinerary.data?.itinerary,
                    },
                };
            });
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
            if (isChatModalOpen) closeChatModal();
            else setIsChatModalOpen(true);
            return;
        }
        return s.handleAction(meta, data);
    };

    if (isLoading || blocked) return <Skeleton />;

    if (krideItinerary.isLoading) {
        return (
            <div className="page-wrap KRIDE_FOCUS kride-focus-state-page">
                <ItineraryLoadingPanel />
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
                <div
                    ref={chatDialogRef}
                    className="kride-focus-chat-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="K-RIDE 여행봇"
                    tabIndex={-1}
                >
                    <KrideChatComponent
                        meta={{ labelText: "K-RIDE 여행봇", cssClass: "h-full w-full" }}
                        data={{}}
                        onCloseModal={closeChatModal}
                    />
                </div>
            )}
        </div>
    );
}
