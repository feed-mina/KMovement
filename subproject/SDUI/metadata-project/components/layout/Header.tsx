'use client';

import { useAuth } from "@/context/AuthContext";
import { usePageMetadata } from "@/components/DynamicEngine/hook/usePageMetadata";
import RecordTimeComponent from "@/components/fields/RecordTimeComponent";
import { usePathname } from 'next/navigation';
import { useMemo } from "react";
import { flattenMetadata } from "../utils/metadataUtils";
import {usePageHook} from "@/components/DynamicEngine/hook/usePageHook";
import Rai from "@/components/fields/kride/atoms/Rai";


export default function Header() {
    // 1. 모든 훅은 최상단에서 무조건 실행되어야 함
    const pathname = usePathname();
    const { user, isLoggedIn } = useAuth();

    // * 메타데이터를 가져옴
    const { metadata, pageData } = usePageMetadata("GLOBAL_HEADER", 1, false, null);

    // * 통합 훅 사용  screenId는 "GLOBAL_HEADER"로 전달
    const { handleAction } = usePageHook("GLOBAL_HEADER", metadata, pageData);
    // * 모든 컴포넌트를 한줄로 쭉 세워서 확인이 필요, 구조를 일렬로 펴줌
    const flatMeta = useMemo(() => flattenMetadata(metadata), [metadata]);

    const KRIDE_PATHS = ['/INTRO1', '/INTRO2', '/INTRO3', '/INTRO4', '/INTRO5', '/MY_LIST', '/FOCUS'];
    const isKrideScreen = KRIDE_PATHS.some(p => pathname?.includes(p));
    if (isKrideScreen) return null;

    const getVal = (obj: any, snake: string, camel: string) => obj?.[snake] || obj?.[camel] || "";

    // 조건 단순화: Context에서 제공하는 isLoggedIn 불리언 값만 신뢰하도록 수정
    const isRealLoggedIn = Boolean(isLoggedIn);
    const isAdmin = user?.role === 'ROLE_ADMIN';

    const loginBtnMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === 'header_login_btn') || {
        actionType: 'ROUTE', actionUrl: '/view/LOGIN_PAGE', labelText: '로그인'
    };

    const isLoginHidden = pathname?.includes('/view/LOGIN_PAGE');
    const hiddenLogoutPaths = ['/view/CONTENT_WRITE', '/view/LOGIN_PAGE'];
    const isLogoutHidden = hiddenLogoutPaths.some(path => pathname?.includes(path));

    // 메타데이터 매핑
    const logoutId = user?.socialType === 'K' ? 'header_kakao_logout' : 'header_general_logout';
    const logoutMeta = flatMeta.find(m => getVal(m, 'component_id', 'componentId') === logoutId) || {
        actionType: user?.socialType === 'K' ? 'KAKAO_LOGOUT' : 'LOGOUT', labelText: '로그아웃'
    };// Header.tsx 내부 return 부분 수정
    return (
        <header className="mobile-header">
            <div className="header-container">
                <div className="header-top-row">
                    <button
                        type="button"
                        className="mobile-brand-logo"
                        onClick={() => handleAction({actionType: 'ROUTE', actionUrl: '/view/MAIN_PAGE'})}
                        aria-label="KRIDE 홈으로 이동"
                    >
                        KRIDE
                    </button>
                    <div className="mobile-header-rai">
                        <Rai state="greeting" size={42} title="라이 캐릭터" />
                    </div>
                    <div className="auth-actions">
                        {isRealLoggedIn ? (
                            (
                                <button className="mobile-auth-btn logout" onClick={() => handleAction(logoutMeta)}>
                                    {getVal(logoutMeta, 'label_text', 'labelText')}
                                </button>
                            )
                        ) : (
                            (
                                <button className="mobile-auth-btn login" onClick={() => handleAction(loginBtnMeta)}>
                                    {getVal(loginBtnMeta, 'label_text', 'labelText')}
                                </button>
                            )
                        )}
                    </div>
                </div>
                {/* AI 통역 단축은 하단 탭 네비 [통역]으로 대체 — 헤더 중복 제거 */}
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
