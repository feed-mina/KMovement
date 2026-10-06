'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';
import Skeleton from '@/components/utils/Skeleton';
import type { ScreenControllerProps } from './types';
import { clearLoginReturn, rememberLoginReturn, safeLoginReturn } from '@/lib/kride/loginReturn';

function LoginScreen() {
    const router = useRouter();
    const search=useSearchParams();
    const returnTo=safeLoginReturn(search.get('returnTo'));
    const { isLoggedIn, isLoading, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && isLoggedIn) router.replace(returnTo);
    }, [isLoading, isLoggedIn, router, returnTo]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting) return;

        setSubmitting(true);
        setError('');
        try {
            await api.post('/api/auth/login', {
                user_email: email.trim(),
                user_pw: password,
            }, {
                headers: { 'X-Platform': 'web' },
            });
            const me = await api.get('/api/auth/me');
            if (!me.data?.isLoggedIn) throw new Error('로그인 상태를 확인하지 못했습니다.');
            clearLoginReturn();
            login(me.data);
            router.replace(returnTo);
        } catch (requestError: any) {
            const message = [400, 401].includes(requestError?.response?.status)
                ? '이메일 또는 비밀번호를 다시 확인해 주세요.'
                : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading || isLoggedIn) return <Skeleton />;

    return (
        <main className="auth-flow-page" aria-labelledby="login-title">
            <section className="auth-flow-card">
                <header className="auth-flow-heading">
                    <h1 id="login-title">로그인</h1>
                    <p>로그인하면 내 프로필과 저장한 K-RIDE 기록을 확인할 수 있어요.</p>
                </header>

                <form className="auth-flow-form" onSubmit={handleSubmit}>
                    <label className="auth-flow-field">
                        이메일
                        <input
                            type="email"
                            name="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </label>
                    <label className="auth-flow-field">
                        비밀번호
                        <input
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </label>
                    {error && <p className="auth-flow-error" role="alert">{error}</p>}
                    <button className="auth-flow-button primary" type="submit" disabled={submitting}>
                        {submitting ? '로그인 확인 중…' : '이메일로 로그인'}
                    </button>
                </form>

                <button
                    className="auth-flow-button kakao"
                    type="button"
                    onClick={() => {
                        rememberLoginReturn(returnTo);
                        window.location.assign('/api/kakao/authorize?state=web');
                    }}
                >
                    카카오로 로그인
                </button>
                <p className="auth-flow-help">인증 토큰은 화면이나 브라우저 저장소에 표시하지 않고 보안 쿠키로만 처리합니다.</p>
            </section>
        </main>
    );
}

function ProfileScreen() {
    const router = useRouter();
    const { user, isLoggedIn, isLoading, logout } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        if (!isLoading && !isLoggedIn) router.replace('/view/LOGIN_PAGE');
    }, [isLoading, isLoggedIn, router]);

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        await logout();
    };

    if (isLoading || !isLoggedIn || !user) return <Skeleton />;

    const socialLabel = user.socialType === 'K' ? '카카오' : '이메일';

    return (
        <main className="auth-flow-page" aria-labelledby="profile-title">
            <section className="auth-flow-card">
                <header className="auth-flow-heading">
                    <h1 id="profile-title">마이페이지</h1>
                    <p>저장한 항목과 계정 정보를 한곳에서 확인해요.</p>
                </header>

                <div className="my-saved-shortcuts" aria-label="저장 목록 바로가기">{[['아티스트','artists'],['이벤트','events'],['상품','products']].map(([label,kind])=><button key={kind} className="auth-flow-button secondary" onClick={()=>router.push('/view/KPOP_SAVED_ITEMS?kind='+kind+'&page=1')}>저장한 {label} →</button>)}</div>
                <dl className="auth-profile-list">
                    <div className="auth-profile-row">
                        <dt>이메일</dt>
                        <dd>{user.email || '등록 정보 없음'}</dd>
                    </div>
                    <div className="auth-profile-row">
                        <dt>사용자 ID</dt>
                        <dd>{user.userId || '등록 정보 없음'}</dd>
                    </div>
                    <div className="auth-profile-row">
                        <dt>로그인 방식</dt>
                        <dd>{socialLabel}</dd>
                    </div>
                    <div className="auth-profile-row">
                        <dt>계정 상태</dt>
                        <dd>{user.role === 'ROLE_ADMIN' ? '관리자' : '일반 회원'}</dd>
                    </div>
                </dl>

                <div className="auth-flow-actions">
                    <button className="auth-flow-button secondary" type="button" onClick={() => router.push('/view/KPOP_SAVED_ITEMS')}>
                        내 목록 보기
                    </button>
                    <button className="auth-flow-button secondary" type="button" onClick={() => router.push('/')}>
                        홈으로
                    </button>
                    <button className="auth-flow-button primary" type="button" onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? '로그아웃 중…' : '로그아웃'}
                    </button>
                </div>
            </section>
        </main>
    );
}

export default function AuthFlowScreen({ screenId }: ScreenControllerProps) {
    return screenId === 'LOGIN_PAGE' ? <LoginScreen /> : <ProfileScreen />;
}
