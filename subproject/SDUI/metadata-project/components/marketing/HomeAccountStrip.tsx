'use client';

import { useContext } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/context/AuthContext';
import styles from './marketing.module.css';

/**
 * 랜딩 홈의 로그인 전/후 한 줄 (벤치마킹 H3).
 * 서버 컴포넌트인 app/page.tsx 는 로그인 상태를 모르므로, 이 아일랜드만 클라이언트에서 분기한다.
 * - 확인 중: 같은 높이의 빈 자리 (레이아웃이 튀지 않게)
 * - 비로그인: 1줄 배너 + 로그인 (돌아올 곳은 홈)
 * - 로그인: "이어서 하기" — 저장한 목록 · 코스 만들기 · 마이
 */
export default function HomeAccountStrip() {
    const auth = useContext(AuthContext);
    if (!auth || auth.isLoading) return <div className={styles.strip} aria-hidden="true" />;

    if (!auth.isLoggedIn) {
        return (
            <div className={styles.strip}>
                <div className={styles.stripInner}>
                    <p><b>로그인</b>하면 저장한 코스와 아티스트를 이어서 볼 수 있어요</p>
                    <Link className={styles.stripLink} href={`/view/LOGIN_PAGE?returnTo=${encodeURIComponent('/')}`}>로그인</Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.strip}>
            <div className={styles.stripInner}>
                <p><b>이어서 하기</b> · 저장한 아티스트와 코스가 그대로 있어요</p>
                <div className={styles.stripLinks}>
                    <Link href="/view/KPOP_SAVED_ITEMS">저장한 목록</Link>
                    <Link href="/view/ROUTE_PLANNER">코스 만들기</Link>
                    <Link href="/view/MY_PAGE">마이</Link>
                </div>
            </div>
        </div>
    );
}
