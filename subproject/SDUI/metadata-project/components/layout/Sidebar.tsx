'use client';

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePageMetadata } from "@/components/DynamicEngine/hook/usePageMetadata";
import { usePathname } from 'next/navigation';
import { useDeviceType } from "@/hooks/useDeviceType";
import { flattenMetadata } from "../utils/metadataUtils";
import { usePageHook } from "@/components/DynamicEngine/hook/usePageHook";

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

function SidebarLogoToggle({ collapsed, onToggle }: SidebarProps) {
    const label = collapsed ? '사이드바 열기' : '사이드바 닫기';

    return (
        <button
            type="button"
            className="sidebar-logo p-4 font-bold text-xl"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-controls="pc-sidebar-content"
            aria-label={label}
            title={label}
        >
            <span className="sidebar-logo-full" aria-hidden="true">KRIDE</span>
            <span className="sidebar-logo-compact" aria-hidden="true">K</span>
            <span className="sidebar-toggle-indicator" aria-hidden="true">
                {collapsed ? '›' : '‹'}
            </span>
        </button>
    );
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const { isMobile } = useDeviceType();
    const isPc = !isMobile;
    const pathname = usePathname();
    const { user, isLoggedIn } = useAuth();

    const { metadata, pageData, loading: metaLoading } = usePageMetadata("GLOBAL_HEADER", 1, false, null);
    const { handleAction } = usePageHook("GLOBAL_HEADER", metadata, pageData);

    const flatMeta = useMemo(() => flattenMetadata(metadata), [metadata]);

    const isRealLoggedIn = Boolean(isLoggedIn);
    const isAdmin = user?.role === 'ROLE_ADMIN';

    if (!isPc) return null;
    if (metaLoading) {
        return (
            <aside className={`pc-sidebar pc-sidebar-loading flex flex-col h-screen bg-gray-50${collapsed ? ' is-collapsed' : ''}${isAdmin ? ' is-admin' : ''}`}>
                <SidebarLogoToggle collapsed={collapsed} onToggle={onToggle} />
            </aside>
        );
    }

    const getVal = (obj: any, snake: string, camel: string) => obj?.[snake] || obj?.[camel] || "";

    // 조건 단순화: Context에서 제공하는 isLoggedIn 불리언 값만 신뢰하도록 수정
    // 메타데이터 매핑 (디버깅을 위해 콘솔 대신 대체 UI 렌더링 활용)
    const logoutId = user?.socialType === 'K' ? 'header_kakao_logout' : 'header_general_logout';
    const logoutMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === logoutId);
    const loginBtnMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === 'header_login_btn') || {
        componentId: 'header_login_btn_fallback',
        labelText: '로그인',
        actionType: 'ROUTE',
        actionUrl: '/view/LOGIN_PAGE',
    };

    return (
        <aside className={`pc-sidebar flex flex-col justify-between h-screen bg-white border-r${collapsed ? ' is-collapsed' : ''}${isAdmin ? ' is-admin' : ''}`}>
            <div className="sidebar-top flex-1">
                <SidebarLogoToggle collapsed={collapsed} onToggle={onToggle} />

                <div id="pc-sidebar-content" className="sidebar-content">
                {isRealLoggedIn ? (
                    logoutMeta ? (
                        isAdmin ? (
                            <nav className="sidebar-nav mt-4 flex flex-col gap-2 px-4">
                                <button type="button"
                                    aria-current={pathname === '/view/admin/ADMIN_DASHBOARD' ? 'page' : undefined}
                                    className={`nav-item admin-nav-dashboard w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/view/admin/ADMIN_DASHBOARD' ? 'bg-gray-700 font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/admin/ADMIN_DASHBOARD' })}>
                                    대시보드
                                </button>
                                <button type="button"
                                    aria-current={pathname === '/view/admin/USER_LIST' ? 'page' : undefined}
                                    className={`nav-item admin-nav-users w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/view/admin/USER_LIST' ? 'bg-gray-700 font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/admin/USER_LIST' })}>
                                    회원 관리
                                </button>
                                <button type="button"
                                    aria-current={pathname === '/admin/sdui' ? 'page' : undefined}
                                    className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/admin/sdui' ? 'bg-gray-700 font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/admin/sdui' })}>
                                    SDUI Console
                                </button>
                                <button type="button"
                                    aria-current={pathname === '/admin/community' ? 'page' : undefined}
                                    className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/admin/community' ? 'bg-gray-700 font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/admin/community' })}>
                                    커뮤니티 신고·검수
                                </button>
                            </nav>
                        ) : (
                            <nav className="sidebar-nav mt-4 flex flex-col gap-2 px-4">
                                <button type="button"
                                    aria-current={pathname === '/view/TOUR_EXPLORE' ? 'page' : undefined}
                                    className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/view/TOUR_EXPLORE' ? 'bg-accent-soft text-accent font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/TOUR_EXPLORE' })}>
                                    탐색
                                </button>
                                <button type="button"
                                    aria-current={pathname === '/view/ROUTE_PLANNER' ? 'page' : undefined}
                                    className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/view/ROUTE_PLANNER' ? 'bg-accent-soft text-accent font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/ROUTE_PLANNER' })}>
                                    동선
                                </button>
                                <button type="button"
                                    aria-current={pathname?.startsWith('/view/COMMUNITY') ? 'page' : undefined}
                                    className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname?.startsWith('/view/COMMUNITY') ? 'bg-accent-soft text-accent font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/COMMUNITY_LIST' })}>
                                    커뮤니티
                                </button>
                                <button type="button"
                                    aria-current={pathname === '/view/SET_TIME_PAGE' ? 'page' : undefined}
                                    className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/view/SET_TIME_PAGE' ? 'bg-accent-soft text-accent font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/SET_TIME_PAGE' })}>
                                    동행
                                </button>
                                <button type="button"
                                    aria-current={pathname === '/view/MY_PAGE' ? 'page' : undefined}
                                    className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/view/MY_PAGE' ? 'bg-accent-soft text-accent font-bold' : 'bg-transparent'}`}
                                    onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/MY_PAGE' })}>
                                    마이
                                </button>
                                {!isAdmin && <div className="sidebar-ai-section">
                                    <span className="sidebar-ai-label">AI 통역</span>
                                    <button
                                        type="button"
                                        className={`sidebar-ai-btn ja${pathname === '/view/AI_JAPANESE_CHAT_PAGE' ? ' active' : ''}`}
                                        onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/AI_JAPANESE_CHAT_PAGE' })}>
                                        <span className="ai-badge">AI</span>
                                        일본어 채팅
                                    </button>
                                    <button
                                        type="button"
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
                            <button type="button"
                                aria-current={pathname === '/view/MAIN_PAGE' ? 'page' : undefined}
                                className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname === '/view/MAIN_PAGE' ? 'bg-accent-soft text-accent font-bold' : 'bg-transparent'}`}
                                onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/MAIN_PAGE' })}>
                                홈
                            </button>
                            <button type="button"
                                aria-current={pathname?.startsWith('/view/COMMUNITY') ? 'page' : undefined}
                                className={`nav-item w-full border-0 p-2 text-left rounded cursor-pointer ${pathname?.startsWith('/view/COMMUNITY') ? 'bg-accent-soft text-accent font-bold' : 'bg-transparent'}`}
                                onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/COMMUNITY_LIST' })}>
                                커뮤니티
                            </button>
                        </nav>
                    ) : null
                )}
                </div>

            </div>

            <div className="sidebar-footer p-4 border-t border-gray-100">
                {isRealLoggedIn ? (
                    logoutMeta ? (
                        <button type="button" className="sidebar-auth-btn w-full p-2 bg-gray-100 rounded text-center"
                            onClick={() => handleAction(logoutMeta)}>
                            {getVal(logoutMeta, 'label_text', 'labelText')}
                        </button>
                    ) : (
                        <div className="text-red-500 text-sm text-center">로그아웃({logoutId}) 데이터 누락</div>
                    )
                ) : (
                    loginBtnMeta ? (
                        <button type="button" className="sidebar-auth-btn login w-full p-2 bg-accent text-white rounded text-center"
                            onClick={() => handleAction(loginBtnMeta)}>
                            {getVal(loginBtnMeta, 'label_text', 'labelText')}
                        </button>
                    ) : null
                )}
            </div>
        </aside>
    );
}
