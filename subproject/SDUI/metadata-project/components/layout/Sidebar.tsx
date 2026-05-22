'use client';

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePageMetadata } from "@/components/DynamicEngine/hook/usePageMetadata";
import { usePathname } from 'next/navigation';
import { useDeviceType } from "@/hooks/useDeviceType";
import { flattenMetadata } from "../utils/metadataUtils";
import { usePageHook } from "@/components/DynamicEngine/hook/usePageHook";

export default function Sidebar() {
    const { isMobile } = useDeviceType();
    const isPc = !isMobile;
    const pathname = usePathname();
    const { user, isLoggedIn } = useAuth();

    const { metadata, pageData, loading: metaLoading } = usePageMetadata("GLOBAL_HEADER", 1, false, null);
    const { handleAction } = usePageHook("GLOBAL_HEADER", metadata, pageData);

    const flatMeta = useMemo(() => flattenMetadata(metadata), [metadata]);

    if (!isPc) return null;
    if (metaLoading) return <aside className="pc-sidebar-loading w-64 h-screen bg-gray-50" />;

    const getVal = (obj: any, snake: string, camel: string) => obj?.[snake] || obj?.[camel] || "";

    // 조건 단순화: Context에서 제공하는 isLoggedIn 불리언 값만 신뢰하도록 수정
    const isRealLoggedIn = Boolean(isLoggedIn);
    const isAdmin = user?.role === 'ROLE_ADMIN';

    // 메타데이터 매핑 (디버깅을 위해 콘솔 대신 대체 UI 렌더링 활용)
    const logoutId = user?.socialType === 'K' ? 'header_kakao_logout' : 'header_general_logout';
    const logoutMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === logoutId);
    const loginBtnMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === 'header_login_btn');

    return (
        <aside className={`pc-sidebar flex flex-col justify-between h-screen w-64 bg-white border-r${isAdmin ? ' is-admin' : ''}`}>
            <div className="sidebar-top flex-1">
                <div className="sidebar-logo p-4 font-bold text-xl cursor-pointer"
                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/MAIN_PAGE' })}>
                    SDUI Project
                </div>

                {isRealLoggedIn ? (
                    logoutMeta ? (
                        isAdmin ? (
                            <nav className="sidebar-nav mt-4 flex flex-col gap-2 px-4">
                                <div className={`nav-item p-2 rounded cursor-pointer ${pathname === '/view/admin/MAIN_PAGE' ? 'bg-gray-700 font-bold' : ''}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/admin/MAIN_PAGE' })}>
                                    대시보드
                                </div>
                                <div className={`nav-item p-2 rounded cursor-pointer ${pathname === '/view/admin/USER_LIST' ? 'bg-gray-700 font-bold' : ''}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/admin/USER_LIST' })}>
                                    회원 관리
                                </div>
                            </nav>
                        ) : (
                            <nav className="sidebar-nav mt-4 flex flex-col gap-2 px-4">
                                <div className={`nav-item p-2 rounded cursor-pointer ${pathname === '/view/CONTENT_LIST' ? 'bg-green-50 text-green-700 font-bold' : ''}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/CONTENT_LIST' })}>
                                    콘텐츠 리스트 보기
                                </div>
                                <div className={`nav-item p-2 rounded cursor-pointer ${pathname?.startsWith('/view/COMMUNITY') ? 'bg-green-50 text-green-700 font-bold' : ''}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/COMMUNITY_LIST' })}>
                                    커뮤니티
                                </div>
                                <div className={`nav-item p-2 rounded cursor-pointer ${pathname === '/view/SET_TIME_PAGE' ? 'bg-green-50 text-green-700 font-bold' : ''}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/SET_TIME_PAGE' })}>
                                    약속 관리
                                </div>
                                {!isAdmin && <div className="sidebar-ai-section">
                                    <span className="sidebar-ai-label">AI 채팅</span>
                                    <button
                                        className={`sidebar-ai-btn ja${pathname === '/view/AI_JAPANESE_CHAT_PAGE' ? ' active' : ''}`}
                                        onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/AI_JAPANESE_CHAT_PAGE' })}>
                                        <span className="ai-badge">AI</span>
                                        일본어 채팅
                                    </button>
                                    <button
                                        className={`sidebar-ai-btn en${pathname === '/view/AI_ENGLISH_CHAT_PAGE' ? ' active' : ''}`}
                                        onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/AI_ENGLISH_CHAT_PAGE' })}>
                                        <span className="ai-badge">AI</span>
                                        영어 채팅
                                    </button>
                                </div>}
                            </nav>
                        )
                    ) : (
                        <div className="text-red-500 text-sm text-center">로그아웃({logoutId}) 데이터 누락</div>
                    )
                ) : (
                    loginBtnMeta ? (
                        <nav className="sidebar-nav mt-4 flex flex-col gap-2 px-4">
                            <div className={`nav-item p-2 rounded cursor-pointer ${pathname === '/view/MAIN_PAGE' ? 'bg-green-50 text-green-700 font-bold' : ''}`}
                                onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/MAIN_PAGE' })}>
                                홈
                            </div>
                            <div className={`nav-item p-2 rounded cursor-pointer ${pathname?.startsWith('/view/COMMUNITY') ? 'bg-green-50 text-green-700 font-bold' : ''}`}
                                onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/COMMUNITY_LIST' })}>
                                커뮤니티
                            </div>
                            <div className={`nav-item p-2 rounded cursor-pointer ${pathname === '/view/TUTORIAL_PAGE' ? 'bg-green-50 text-green-700 font-bold' : ''}`}
                                onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/TUTORIAL_PAGE' })}>
                                튜토리얼 보러가기
                            </div>
                        </nav>
                    ) : (
                        <div className="text-red-500 text-sm text-center">로그인 메타데이터 누락</div>
                    )
                )}

            </div>

            <div className="sidebar-footer p-4 border-t border-gray-100">
                {isRealLoggedIn ? (
                    logoutMeta ? (
                        <button className="sidebar-auth-btn w-full p-2 bg-gray-100 rounded text-center"
                            onClick={() => handleAction(logoutMeta)}>
                            {getVal(logoutMeta, 'label_text', 'labelText')}
                        </button>
                    ) : (
                        <div className="text-red-500 text-sm text-center">로그아웃({logoutId}) 데이터 누락</div>
                    )
                ) : (
                    loginBtnMeta ? (
                        <button className="sidebar-auth-btn login w-full p-2 bg-blue-500 text-white rounded text-center"
                            onClick={() => handleAction(loginBtnMeta)}>
                            {getVal(loginBtnMeta, 'label_text', 'labelText')}
                        </button>
                    ) : (
                        <div className="text-red-500 text-sm text-center">로그인 메타데이터 누락</div>
                    )
                )}
            </div>
        </aside>
    );
}
