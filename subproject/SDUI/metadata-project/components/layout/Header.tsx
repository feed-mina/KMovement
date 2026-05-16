'use client';

import { useAuth } from "@/context/AuthContext";
import { usePageMetadata } from "@/components/DynamicEngine/hook/usePageMetadata";
import RecordTimeComponent from "@/components/fields/RecordTimeComponent";
import { usePathname } from 'next/navigation';
import { useMemo } from "react";
import { flattenMetadata } from "../utils/metadataUtils";
import Skeleton from "@/components/utils/Skeleton";
import {usePageHook} from "@/components/DynamicEngine/hook/usePageHook";
import { useDeviceType } from "@/hooks/useDeviceType";


export default function Header() {
    const { isMobile } = useDeviceType();
    // 1. 모든 훅은 최상단에서 무조건 실행되어야 함
    const pathname = usePathname();
    const { user, isLoggedIn } = useAuth();

    // * 메타데이터를 가져옴
    const { metadata, pageData, loading: metaLoading } =  usePageMetadata("GLOBAL_HEADER",1, false, null);

    // * 통합 훅 사용  screenId는 "GLOBAL_HEADER"로 전달
    const { handleAction } = usePageHook("GLOBAL_HEADER", metadata, pageData);
    // * 모든 컴포넌트를 한줄로 쭉 세워서 확인이 필요, 구조를 일렬로 펴줌
    const flatMeta = useMemo(() => flattenMetadata(metadata), [metadata]);

    if (!isMobile) return null;

    const KRIDE_PATHS = ['/INTRO1', '/INTRO2', '/INTRO3', '/INTRO4', '/INTRO5', '/MY_LIST', '/FOCUS'];
    const isKrideScreen = KRIDE_PATHS.some(p => pathname?.includes(p));
    if (isKrideScreen) return null;

    if (metaLoading) return <div className="header-loading"><Skeleton/></div>;


    const getVal = (obj: any, snake: string, camel: string) => obj?.[snake] || obj?.[camel] || "";

    // 조건 단순화: Context에서 제공하는 isLoggedIn 불리언 값만 신뢰하도록 수정
    const isRealLoggedIn = Boolean(isLoggedIn);
    const isAdmin = user?.role === 'ROLE_ADMIN';

    const generalLogoutMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === 'header_general_logout');
    const kakaoLogoutMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === 'header_kakao_logout');
    const loginBtnMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === 'header_login_btn');

    const isLoginHidden = pathname?.includes('/view/LOGIN_PAGE');
    const hiddenLogoutPaths = ['/view/CONTENT_WRITE', '/view/LOGIN_PAGE'];
    const isLogoutHidden = hiddenLogoutPaths.some(path => pathname?.includes(path));

    // 메타데이터 매핑
    const logoutId = user?.socialType === 'K' ? 'header_kakao_logout' : 'header_general_logout';
    const logoutMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === logoutId);// Header.tsx 내부 return 부분 수정
    return (
        <header className="mobile-header">
            <div className="header-container">
                <div className="header-top-row">
                    <div className="logo" onClick={() => handleAction({actionType: 'ROUTE', actionUrl: '/view/MAIN_PAGE'})}>
                        SDUI Project
                    </div>
                    <div className="auth-actions">
                        {isRealLoggedIn ? (
                            logoutMeta && (
                                <button className="mobile-auth-btn logout" onClick={() => handleAction(logoutMeta)}>
                                    {getVal(logoutMeta, 'label_text', 'labelText')}
                                </button>
                            )
                        ) : (
                            loginBtnMeta && (
                                <button className="mobile-auth-btn login" onClick={() => handleAction(loginBtnMeta)}>
                                    {getVal(loginBtnMeta, 'label_text', 'labelText')}
                                </button>
                            )
                        )}
                    </div>
                </div>
                {isRealLoggedIn && !isAdmin && (
                    <div className="header-ai-shortcuts">
                        <button
                            className={`header-ai-btn ja${pathname === '/view/AI_JAPANESE_CHAT_PAGE' ? ' active' : ''}`}
                            onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/AI_JAPANESE_CHAT_PAGE' })}>
                            <span className="ai-badge">AI</span>
                            일본어 채팅
                        </button>
                        <button
                            className={`header-ai-btn en${pathname === '/view/AI_ENGLISH_CHAT_PAGE' ? ' active' : ''}`}
                            onClick={() => handleAction({ actionType: 'ROUTE', actionUrl: '/view/AI_ENGLISH_CHAT_PAGE' })}>
                            <span className="ai-badge">AI</span>
                            영어 채팅
                        </button>
                    </div>
                )}
                {pathname !== '/view/MAIN_PAGE' && (
                    <div className="header-bottom-row">
                        <div className="time-card">
                            <RecordTimeComponent />
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}