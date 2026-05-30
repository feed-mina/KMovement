// app/view/[screenId]/page.tsx
'use client'; // 상태 관리와 이벤트를 위해 클라이언트 컴포넌트로 설정합니다.

import {useEffect, useMemo, useState} from "react";
import DynamicEngine from "@/components/DynamicEngine";
import Pagination from "@/components/fields/Pagination";
import FilterToggle from "@/components/utils/FilterToggle";
import {usePageMetadata} from "@/components/DynamicEngine/hook/usePageMetadata";
// import {usePageActions} from "@/components/DynamicEngine/hook/usePageActions";
import Skeleton from "@/components/utils/Skeleton";
import { useAuth } from "@/context/AuthContext";
import {useRouter, useSearchParams} from "next/navigation";
import {usePageHook} from "@/components/DynamicEngine/hook/usePageHook";
import {useKrideItinerary} from "@/components/DynamicEngine/hook/useKrideItinerary";
import {useMetadata} from "@/components/providers/MetadataProvider";
import axios from "@/services/axios";
import CommunityPage from "@/components/community/CommunityPage";



//  보호가 필요한 스크린 ID 목록 정의
const PROTECTED_SCREENS = ["MY_PAGE", "CONTENT_LIST", "CONTENT_WRITE", "CONTENT_DETAIL", "CONTENT_MODIFY", "USER_LIST", "AI_ENGLISH_CHAT_PAGE", "AI_KOREAN_CHAT_PAGE", "KRIDE_MY_LIST", "KRIDE_CHAT"];


import KrideChatComponent from "@/components/fields/kride/chat/KrideChatComponent";

// CommonPage 역할 : 전체 화면의 구성, 메타데이터와 데이터를 가져와 엔진에 전달
export default function CommonPage() {

    // 이제 params를 직접 파싱하지 않고 컨텍스트에서 꺼내 쓴다
    const { screenId, refId } = useMetadata();

    if (screenId.startsWith("COMMUNITY_")) {
        return <CommunityPage screenId={screenId} refId={refId} />;
    }

    return <SduiPage screenId={screenId} refId={refId} />;
}

function SduiPage({ screenId, refId }: { screenId: string; refId: string | number | null }) {

    const router = useRouter();
    const searchParams = useSearchParams();
    // 인증 상태 가져오기
    const { isLoggedIn, isLoading } = useAuth();
    // * 상태 선언(useState)를 훅 호출보다 위로 올림
    const [currentPage, setCurrentPage] = useState(1);
    const [isOnlyMine, setIsOnlyMine] = useState(false);
    
    // 챗봇 모달 상태 (FOCUS 화면 진입 시 기본적으로 열림)
    const [isChatModalOpen, setIsChatModalOpen] = useState(screenId === "KRIDE_FOCUS");

    //   메타데이터 훅 호출 (가공된 metadata를 가져옴)
    const {metadata, pageData, totalCount, loading: dataLoading} = usePageMetadata(
        screenId, // MetadataProvider 에서 가져온 screenId
        currentPage,
        isOnlyMine,
        refId
    );
    const {formData, setFormData, handleChange, handleAction: defaultHandleAction, showPassword, pwType, activeModal, closeModal} = usePageHook(screenId, metadata, pageData);
    const krideItinerary = useKrideItinerary(screenId, formData);

    // 구글 캘린더 OAuth 콜백 처리
    useEffect(() => {
        if (screenId !== "GOOGLE_CALLBACK") return;
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        if (!code || !state) {
            router.replace("/view/SET_TIME_PAGE");
            return;
        }
        axios.get(`/api/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
            .then(() => {
                alert("구글 캘린더가 연결되었습니다.");
                router.replace("/view/SET_TIME_PAGE");
            })
            .catch(() => {
                alert("구글 캘린더 연결에 실패했습니다. 다시 시도해주세요.");
                router.replace("/view/SET_TIME_PAGE");
            });
    }, [screenId, searchParams, router]);

    //   접근 권한 체크 로직 (로그인 여부 확인)
    useEffect(() => {
        // 로딩 중이 아닐 때만 판단
        if (!isLoading) {
            const isProtected = PROTECTED_SCREENS.includes(screenId);
            if (isProtected && !isLoggedIn) {
                if (screenId.startsWith("KRIDE_")) {
                    alert("로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.");
                }
                router.replace("/view/LOGIN_PAGE");
            }
        }
    }, [isLoading, isLoggedIn, screenId, router]);


    // @@@@ 2026-02-07 추가 서버 데이터(pageData)와 사용자 입력 데이터(formData)를 합친다. 사용자 입력값이 있을 경우 formData를 우선하고 없으면 초기값을 쓴다

    const combineData = useMemo(() => ({
        ...pageData,
        ...krideItinerary.data,
        ...formData
    }), [pageData, krideItinerary.data, formData]);

    const handleToggleMine = () => {
        setIsOnlyMine(prev => !prev);
        setCurrentPage(1);
    };

    // 액션 핸들러 래핑 (채팅 모달 열기 가로채기)
    const handleAction = async (meta: any, data?: any) => {
        const actionUrl = meta?.actionUrl || meta?.action_url;
        if (screenId === "KRIDE_FOCUS" && (actionUrl === "/view/CHAT" || actionUrl === "/view/KRIDE_CHAT")) {
            setIsChatModalOpen(prev => !prev); // 토글
            return;
        }
        return defaultHandleAction(meta, data);
    };


    // 구글 콜백 처리 중 로딩 표시
    if (screenId === "GOOGLE_CALLBACK") {
        return <Skeleton/>;
    }

    // @@@@ 2026-02-04 스켈레톤 UI로 바꿈
    if (isLoading || (PROTECTED_SCREENS.includes(screenId) && !isLoggedIn) ) {
        return <Skeleton/>
    }

    // KRIDE FOCUS 로딩/에러 표시
    if (screenId === "KRIDE_FOCUS" && krideItinerary.isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white gap-4">
                <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-lg font-medium">AI가 여행 일정을 만들고 있어요...</p>
                <p className="text-sm text-gray-400">잠시만 기다려주세요</p>
            </div>
        );
    }

    if (screenId === "KRIDE_FOCUS" && krideItinerary.error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white gap-4">
                <p className="text-lg font-medium">일정 생성에 실패했어요</p>
                <p className="text-sm text-gray-400">{krideItinerary.error}</p>
                <button
                    className="mt-4 px-6 py-3 bg-red-600 rounded-full text-white font-bold"
                    onClick={() => window.location.reload()}
                >
                    다시 시도
                </button>
            </div>
        );
    }

    return (
        <div className={`page-wrap ${screenId}`}>
            {/* 리스트 페이지용 컴포넌트 */}
            {screenId === "CONTENT_LIST" && (
                <FilterToggle isOnlyMine={isOnlyMine} onToggle={handleToggleMine}/>
            )}
            <DynamicEngine
                screenId={screenId}
                metadata={metadata}
                pageData={combineData}
                formData={formData}
                setFormData={setFormData}
                onChange={handleChange}
                onAction={handleAction}
                pwType={pwType}
                showPassword={showPassword}
                activeModal={activeModal}
                closeModal={closeModal}
            />

            {/* 리스트 페이지용 페이징 */}
            {screenId === "CONTENT_LIST" && (
                <Pagination
                    totalCount={totalCount}
                    pageSize={5}
                    currentPage={currentPage}
                    onPageChange={(page) => {
                        setCurrentPage(page);
                        // console.log(`[페이지 변경] 현재 페이지: ${currentPage}, 변경된 페이지: ${page}`);
                    }}
                />
            )}

            {/* Floating Chat Modal for KRIDE_FOCUS */}
            {screenId === "KRIDE_FOCUS" && isChatModalOpen && (
                <div className="fixed bottom-[90px] right-6 w-[380px] h-[600px] max-h-[75vh] z-[100] shadow-2xl rounded-2xl overflow-hidden border border-gray-700 bg-[#0A0A0A] flex flex-col">
                    <KrideChatComponent 
                        meta={{ labelText: 'K-RIDE 여행봇', cssClass: 'h-full w-full' }} 
                        data={{}}
                        onCloseModal={() => setIsChatModalOpen(false)}
                    />
                </div>
            )}
        </div>
    );
}
