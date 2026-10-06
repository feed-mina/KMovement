'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';
import ScreenSkeleton from '@/components/utils/ScreenSkeleton';
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

    if (isLoading || isLoggedIn) return <ScreenSkeleton blocks={1} label="로그인 상태를 확인하는 중" />;

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

function initialsOf(value: string): string {
    const cleaned = (value || '').trim();
    return cleaned ? cleaned.slice(0, 1).toUpperCase() : '?';
}

type SavedCounts = { artists: number | null; events: number | null; products: number | null };
const SAVED_KINDS: Array<[keyof SavedCounts, string]> = [['artists', '아티스트'], ['events', '이벤트'], ['products', '상품']];

/**
 * 마이페이지 (벤치마킹 G5).
 * 레퍼런스 4/4 공통 구조: 아바타+이름+이메일 헤더 → 저장 숫자 타일 → 설정 목록 → 로그아웃/탈퇴는 하단 텍스트.
 * 파괴적 행동(로그아웃)은 Primary 색을 쓰지 않고 확인 1단계를 거친다. 실패하면 문구 + 재시도.
 */
function ProfileScreen() {
    const router = useRouter();
    const { user, isLoggedIn, isLoading, logout } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);
    const [confirmingLogout, setConfirmingLogout] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [counts, setCounts] = useState<SavedCounts>({ artists: null, events: null, products: null });

    useEffect(() => {
        if (!isLoading && !isLoggedIn) router.replace('/view/LOGIN_PAGE');
    }, [isLoading, isLoggedIn, router]);

    // 저장 개수 3종. 실패하면 타일에 "–" 로 두고 화면은 그대로 쓴다.
    useEffect(() => {
        if (!isLoggedIn || typeof fetch !== 'function') return;
        const abort = new AbortController();
        SAVED_KINDS.forEach(([kind]) => {
            Promise.resolve()
                .then(() => fetch(`/api/v1/kpop/me/saved/${kind}?page=1`, { credentials: 'include', cache: 'no-store', signal: abort.signal }))
                .then(async (r) => (r && r.ok ? (await r.json())?.data?.totalCount : null))
                .then((total) => { if (!abort.signal.aborted) setCounts((c) => ({ ...c, [kind]: typeof total === 'number' ? total : null })); })
                .catch(() => { /* 타일은 "–" 유지 */ });
        });
        return () => abort.abort();
    }, [isLoggedIn]);

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        setLogoutError('');
        try {
            await logout();
        } catch {
            setLogoutError('로그아웃하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.');
            setLoggingOut(false);
        }
    };

    if (isLoading || !isLoggedIn || !user) return <ScreenSkeleton blocks={2} label="계정 정보를 불러오는 중" />;

    const socialLabel = user.socialType === 'K' ? '카카오' : '이메일';
    const displayName = user.userId || user.email || '회원';

    return (
        <main className="auth-flow-page" aria-labelledby="profile-title">
            <section className="auth-flow-card">
                <header className="auth-profile-header">
                    <span className="auth-profile-avatar" aria-hidden="true">{initialsOf(displayName)}</span>
                    <div className="auth-profile-header__copy">
                        <h1 id="profile-title">{displayName}</h1>
                        <p className="auth-profile-header__meta">
                            <span>{user.email || '이메일 없음'}</span>
                            <span className="auth-profile-badge">{socialLabel} 로그인</span>
                        </p>
                    </div>
                </header>

                <div className="auth-profile-stats" aria-label="저장 목록">
                    {SAVED_KINDS.map(([kind, label]) => (
                        <button
                            key={kind}
                            type="button"
                            className="auth-profile-stat"
                            onClick={() => router.push('/view/KPOP_SAVED_ITEMS?kind=' + kind + '&page=1')}
                            aria-label={`저장한 ${label} ${counts[kind] ?? '–'}개 보기`}
                        >
                            <strong>{counts[kind] ?? '–'}</strong>
                            <span>저장한 {label}</span>
                        </button>
                    ))}
                </div>

                <dl className="auth-profile-list">
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

                <nav className="auth-profile-menu" aria-label="설정">
                    <button type="button" className="auth-profile-menu__row" onClick={() => router.push('/view/KPOP_SAVED_ITEMS')}>
                        <span>내 목록 보기</span><span aria-hidden="true">›</span>
                    </button>
                    <button type="button" className="auth-profile-menu__row" onClick={() => router.push('/view/SET_TIME_PAGE')}>
                        <span>오늘의 약속 시간</span><span aria-hidden="true">›</span>
                    </button>
                    <button type="button" className="auth-profile-menu__row" onClick={() => router.push('/view/MAIN_PAGE')}>
                        <span>홈으로</span><span aria-hidden="true">›</span>
                    </button>
                </nav>

                {logoutError && <p className="auth-flow-error" role="alert">{logoutError}</p>}

                <div className="auth-profile-footer">
                    {confirmingLogout ? (
                        <div className="auth-profile-confirm" role="group" aria-label="로그아웃 확인">
                            <span>정말 로그아웃할까요?</span>
                            <button className="auth-flow-button secondary" type="button" onClick={() => setConfirmingLogout(false)} disabled={loggingOut}>취소</button>
                            <button className="auth-flow-button danger" type="button" onClick={handleLogout} disabled={loggingOut}>
                                {loggingOut ? '로그아웃 중…' : logoutError ? '다시 시도' : '네, 로그아웃'}
                            </button>
                        </div>
                    ) : (
                        <button className="auth-flow-textlink" type="button" onClick={() => setConfirmingLogout(true)}>
                            로그아웃
                        </button>
                    )}
                    <Link className="auth-flow-textlink auth-flow-textlink--danger" href="/view/COMMUNITY_LIST">회원 탈퇴 문의</Link>
                </div>
            </section>
        </main>
    );
}

export default function AuthFlowScreen({ screenId }: ScreenControllerProps) {
    return screenId === 'LOGIN_PAGE' ? <LoginScreen /> : <ProfileScreen />;
}
