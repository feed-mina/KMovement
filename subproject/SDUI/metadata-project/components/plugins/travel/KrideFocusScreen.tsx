'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ScreenSkeleton from "@/components/utils/ScreenSkeleton";
import { useScreenGuard } from "@/components/screens/useScreenGuard";
import { useSduiScreen } from "@/components/screens/useSduiScreen";
import SduiRenderer from "@/components/screens/SduiRenderer";
import type { ScreenControllerProps } from "@/components/screens/types";
import { useKrideItinerary } from "@/components/DynamicEngine/hook/useKrideItinerary";
import { KrideButton, RaiStatePanel } from "@/components/fields/kride/atoms/KridePrimitives";
import { KrideStateChips } from "@/components/fields/kride/atoms/KrideStatePanel";
import { RETRY_COOLDOWN_AFTER, RETRY_COOLDOWN_MS } from "@/components/DynamicEngine/hook/useKrideItinerary";
import KrideChatComponent from "@/components/fields/kride/chat/KrideChatComponent";
import { preferNonEmptyMarkers } from "@/components/fields/kride/maps/normalizeRouteMapData";
import ItineraryLoadingPanel from "@/components/fields/kride/ItineraryLoadingPanel";

// KRIDE_FOCUS 화면 컨트롤러 (여행 플러그인).
// AI 일정 추천 훅, 챗봇 실시간 반영, 상태 패널, 플로팅 챗 모달을 담당한다.
// 코어 라우터(page.tsx)에서 이 로직을 걷어내기 위한 격리 지점이다.
export default function KrideFocusScreen({ screenId, refId }: ScreenControllerProps) {
    const router = useRouter();
    const { isLoading, blocked } = useScreenGuard(screenId);
    const s = useSduiScreen(screenId, refId);
    const [courseConfirmed,setCourseConfirmed] = useState(false);
    const [acknowledged,setAcknowledged] = useState(false);
    const [responseLocale,setResponseLocale] = useState<'ko'|'en'|'ja'>('ko');
    const krideItinerary = useKrideItinerary(screenId, {...s.formData,responseLocale,acknowledgeUnverifiedConditions:acknowledged},courseConfirmed);

    // FOCUS 진입 시 챗 모달 기본 오픈
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    // 연속 실패 시 재시도 버튼을 잠시 잠근다 (벤치마킹 G2 선택지).
    // setState 는 타이머 콜백 안에서만 호출한다 (react-hooks/set-state-in-effect).
    const failCountForLock = krideItinerary.failCount ?? 0;
    const [retryLocked, setRetryLocked] = useState(false);
    useEffect(() => {
        if (failCountForLock < RETRY_COOLDOWN_AFTER) {
            const unlock = setTimeout(() => setRetryLocked(false), 0);
            return () => clearTimeout(unlock);
        }
        const lockT = setTimeout(() => setRetryLocked(true), 0);
        const unlockT = setTimeout(() => setRetryLocked(false), RETRY_COOLDOWN_MS);
        return () => { clearTimeout(lockT); clearTimeout(unlockT); };
    }, [failCountForLock]);
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
                    source_pois:krideItinerary.data?.source_pois,
                    scopeNotice:krideItinerary.data?.scopeNotice,
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

    if (isLoading || blocked) return <ScreenSkeleton />;

    if (!courseConfirmed) return <section className="kride-focus-state-card" style={{maxWidth:760,margin:'32px auto',padding:24,color:'#172033',background:'#fff'}}>
        <h1>코스 안내를 확인해 주세요</h1>
        <p>현재 서울·당일치기 일반 장소를 안내합니다. 선택한 아티스트와의 연관, 예산 충족, 영업시간·예약 가능 여부는 미확인입니다.</p>
        <label>안내 언어 <select value={responseLocale} onChange={e=>setResponseLocale(e.target.value as 'ko'|'en'|'ja')}><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option></select></label>
        <p><label><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> 위 조건의 충족을 보장하지 않는 일반 장소 코스로 진행합니다.</label></p>
        <KrideButton disabled={!acknowledged} onClick={()=>setCourseConfirmed(true)}>코스 만들기</KrideButton>
        <Link href="/view/INTRO1">지역·기간 바꾸기</Link>
    </section>;

    if (krideItinerary.isLoading) {
        return (
            <div className="page-wrap KRIDE_FOCUS kride-focus-state-page">
                <ItineraryLoadingPanel />
            </div>
        );
    }

    if (krideItinerary.error) {
        const kind = krideItinerary.errorKind ?? (krideItinerary.requiresLogin ? 'login' : krideItinerary.candidatesUnavailable ? 'candidates' : 'server');
        const failCount = krideItinerary.failCount ?? 0;
        const cooled = failCount >= RETRY_COOLDOWN_AFTER;
        const title = kind === 'login' ? '로그인이 필요해요'
            : kind === 'candidates' ? '추천 자료를 준비 중이에요'
            : kind === 'no-route' ? '조건에 맞는 코스를 못 찾았어요'
            : kind === 'offline' ? '인터넷 연결을 확인해 주세요'
            : '코스를 아직 못 만들었어요';
        const description = cooled && kind !== 'login' && kind !== 'candidates'
            ? `${failCount}번 연속 실패했어요. 잠시 후 다시 시도하거나 조건을 바꿔 보세요. (재시도는 ${RETRY_COOLDOWN_MS / 1000}초 뒤 다시 열려요)`
            : krideItinerary.error;
        // 사용자가 넣은 조건을 그대로 보여준다 (레퍼런스 3/4). 새로고침이 아니라 retry() 라서 조건이 사라지지 않는다.
        const form = s.formData ?? {};
        const chips = [
            ...((form.selectedArtists ?? []) as any[]).map((a) => ({ text: a?.name ?? String(a), accent: true })),
            ...((form.selectedRegions ?? []) as any[]).map((r) => ({ text: r?.name ?? String(r) })),
            ...(form.duration ? [{ text: ({ day: '당일치기', onenight: '1박 2일', twonight: '2박 3일' } as Record<string, string>)[form.duration] ?? String(form.duration) }] : []),
        ];
        const primary = kind === 'login'
            ? { label: '로그인하기', onClick: () => router.push('/view/LOGIN_PAGE') }
            : kind === 'candidates'
                ? { label: '홈으로', onClick: () => router.push('/') }
                : { label: '다시 시도', onClick: () => krideItinerary.retry?.(), disabled: retryLocked };
        return (
            <div className="page-wrap KRIDE_FOCUS kride-focus-state-page">
                <RaiStatePanel
                    state="sad"
                    eyebrow="K-RIDE AI"
                    title={title}
                    description={description}
                    className="kride-focus-state-card"
                >
                    {chips.length > 0 && kind !== 'login' && kind !== 'candidates' && (
                        <KrideStateChips label="내가 고른 조건" items={chips} />
                    )}
                    <div className="kride-focus-state-card__actions">
                        <KrideButton onClick={primary.onClick} disabled={primary.disabled}>
                            {primary.label}
                        </KrideButton>
                        {kind !== 'login' && kind !== 'candidates' && (
                            <KrideButton variant="ghost" onClick={() => router.push('/view/INTRO1')}>
                                조건 바꾸기
                            </KrideButton>
                        )}
                    </div>
                    {kind !== 'login' && (
                        <div className="kride-focus-state-card__links">
                            <Link href="/view/kpop">인기 아티스트·이벤트 둘러보기</Link>
                            <Link href="/view/MAIN_PAGE">홈으로</Link>
                        </div>
                    )}
                </RaiStatePanel>
            </div>
        );
    }

    return (
        <div className={`page-wrap ${screenId}`}>
            {combineData.scopeNotice&&<p className="kride-chat-scope">{combineData.scopeNotice}</p>}
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

            <section aria-label="이 코스에 질문하기" style={{margin:'24px auto',maxWidth:1100}}>
                <h2>이 코스에 질문하기 · Ask about this course</h2>
                <KrideChatComponent meta={{labelText:'이 코스에 질문하기'}} data={{courseContext:krideItinerary.data?.courseContext,responseLocale,contextOverride:s.formData}} />
            </section>

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
                        data={{courseContext:krideItinerary.data?.courseContext,responseLocale,contextOverride:s.formData}}
                        onCloseModal={closeChatModal}
                    />
                </div>
            )}
        </div>
    );
}
