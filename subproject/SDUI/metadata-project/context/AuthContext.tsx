// context/AuthContext.tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '@/services/axios';
import { useRouter } from "next/navigation";
import { requestForToken, onMessageListener } from '@/lib/firebase';

interface User {
    userId?: string;
    userSqno?: number;
    email?: string;
    socialType?: string;
    isLoggedIn: boolean;
    role?: string; // RBAC 구분값 (예: 'ADMIN', 'USER', 'GUEST')
}
interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    updateUser: (userData: User | null) => void;
    login: (userData: any) => void;
    logout: () => Promise<void>;
    checkAccess: (allowedRoles?: string | string[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    // 로그인 성공 시 호출할 함수
    const login = (userData: any) => {
        setUser(userData);
        setIsLoggedIn(true);
    };


    //  로그아웃
    const logout = useCallback(async () => {
        try {
            // 1. 서버에 로그아웃 알림 (세션/쿠키 만료 처리 요청)
            await api.post('/api/auth/logout');
        } catch (err) {
            // console.error("Logout API error:", err);
            // 서버 에러가 나더라도 클라이언트 상태는 지우는 게 사용자 입장에서 안전해
        } finally {
            //  클라이언트 상태 초기화
            setUser(null);
            setIsLoggedIn(false);
            // 브라우저 저장소나 쿠키 수동 삭제
            document.cookie = "loginType=; path=/; max-age=0;";
            // 로그인 페이지로 강제 이동 (필요시)
            router.push('/view/LOGIN_PAGE');
        }
    }, [router]);
    // * 권한 체크 함수
    const checkAccess = useCallback((allowedRoles?: string | string[]) => {
        // 제한이 없으면 누구나 접근 가능
        if (!allowedRoles || (Array.isArray(allowedRoles) && allowedRoles.length === 0)) return true;

        //  현재 유저의 역할 확인 (없으면 GUEST)
        const userRole = user?.role || 'GUEST';

        //  배열로 변환해서 포함 여부 확인
        const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        return rolesArray.includes(userRole);
    }, [user]);

    const checkLoginStatus = async () => {
        try {
            // /api/auth/me를 호출하면 브라우저가 HttpOnly 쿠키를 자동으로 실어 보냄
            const res = await api.get('/api/auth/me');
            setUser(res.data);
            setIsLoggedIn(res.data.isLoggedIn);
        } catch (err) {
            setUser(null);
            setIsLoggedIn(false);

        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkLoginStatus();
    }, []);

    // RBAC: 카카오 로그인 후 ROLE_GUEST이면 추가 정보 입력 페이지로 리다이렉트 (2026-03-01 추가)
    useEffect(() => {
        if (!isLoading && user?.role === 'ROLE_GUEST') {
            const currentPath = window.location.pathname;
            // 이미 추가 정보 입력 페이지에 있으면 리다이렉트하지 않음 (무한 루프 방지)
            if (currentPath !== '/view/ADDITIONAL_INFO_PAGE') {
                // console.log('ROLE_GUEST 감지: 추가 정보 입력 페이지로 리다이렉트');
                router.push('/view/ADDITIONAL_INFO_PAGE');
            }
        }
    }, [isLoading, user, router]);

    // FCM 푸시 알림 설정 (로그인 되었을 때만)
    useEffect(() => {
        if (isLoggedIn) {
            // 브라우저 알림 권한 요청 및 FCM 토큰 획득
            requestForToken().then((token) => {
                if (token) {
                    console.log("FCM 토큰 백엔드 전송 (예정): ", token);
                    // TODO: 백엔드 API 연동 시 주석 해제
                    // api.post('/api/users/fcm-token', { token }).catch(console.error);
                }
            });

            // 화면을 보고 있을 때(Foreground) 알림 수신
            const setupMessageListener = async () => {
                try {
                    const payload: any = await onMessageListener();
                    console.log("포그라운드 알림 수신: ", payload);
                    // 브라우저 알림이나 Toast UI로 대체 가능
                    alert(`[새 알림] ${payload?.notification?.title}\n${payload?.notification?.body}`);
                    // 리스너 재귀 등록 (한 번 받으면 끝나는 Promise 구조이므로)
                    setupMessageListener();
                } catch (err) {
                    console.log('Foreground 메시지 리스너 오류: ', err);
                }
            };
            setupMessageListener();
        }
    }, [isLoggedIn]);

    return (

        <AuthContext.Provider value={{
            user, isLoggedIn, isLoading, updateUser: setUser, login, logout,
            checkAccess
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth는 AuthProvider 안에서 사용.");
    return context;
};