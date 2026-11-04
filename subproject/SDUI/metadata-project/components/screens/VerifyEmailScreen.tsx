'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/services/axios';

export default function VerifyEmailScreen() {
    const search = useSearchParams();
    const router = useRouter();
    const email = search.get('email') || '';
    const [code, setCode] = useState(search.get('code') || '');
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    async function request(resend: boolean) {
        if (pending.current || !email) return;
        pending.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await api.post(resend ? '/api/auth/resend-code' : '/api/auth/verify-code',
                resend ? { email } : { email, code }, { headers: { 'X-Platform': 'web' } });
            if (resend) {
                setCode('');
                setMessage('새 인증번호를 보냈습니다. 받은편지함과 스팸함을 확인해 주세요.');
            } else {
                router.replace('/view/LOGIN_PAGE');
            }
        } catch {
            setError(resend
                ? '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요. 다시 가입할 필요는 없습니다.'
                : '인증하지 못했습니다. 가장 최근에 받은 인증번호를 확인해 주세요.');
        } finally {
            pending.current = false;
            setBusy(false);
        }
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void request(false);
    }

    return (
        <main className="auth-flow-page" aria-labelledby="verify-title">
            <section className="auth-flow-card">
                <header className="auth-flow-heading">
                    <h1 id="verify-title">이메일 인증</h1>
                    <p>메일로 받은 인증번호를 입력해 주세요.</p>
                </header>
                <form className="auth-flow-form" onSubmit={submit}>
                    <label className="auth-flow-field">가입한 이메일
                        <input type="email" value={email} readOnly />
                    </label>
                    <label className="auth-flow-field">인증번호
                        <input value={code} onChange={e => setCode(e.target.value)}
                            inputMode="numeric" autoComplete="one-time-code" required />
                    </label>
                    {!email && <p role="alert">가입한 이메일이 없습니다. 회원가입 화면에서 다시 확인해 주세요.</p>}
                    {error && <p className="auth-flow-error" role="alert">{error}</p>}
                    {message && <p role="status">{message}</p>}
                    <button className="auth-flow-button secondary" type="submit" disabled={busy || !email}>
                        {busy ? '처리 중…' : '인증 완료'}
                    </button>
                    <button className="auth-flow-button ghost" type="button" disabled={busy || !email}
                        onClick={() => void request(true)}>인증 메일 다시 받기</button>
                </form>
                <p className="auth-flow-help">메일이 보이지 않으면 스팸함도 확인해 주세요.</p>
                <Link href="/view/LOGIN_PAGE">로그인으로 돌아가기</Link>
            </section>
        </main>
    );
}
