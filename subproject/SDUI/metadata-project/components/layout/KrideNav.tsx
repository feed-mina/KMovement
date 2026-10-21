'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import PrivacySettingsButton from '@/components/privacy/PrivacySettingsButton';

/**
 * 사이트 공통 내비 (벤치마킹 H0, 2026-10-20).
 * - 상단 탭 5개(홈·탐색·코스 만들기·K-POP·마이) + 더보기. 750px 이하에서는 같은 nav 가 하단 탭 바로 바뀐다(CSS).
 * - "홈" 은 로고와 같은 `/` 한 곳. "코스 만들기" 는 ROUTE_PLANNER 한 곳이고, 5단계 위자드(INTRO1)는 "아티스트 코스" 로 더보기에 둔다.
 * - 활성 표시는 화면당 하나만: 탭에 없으면 더보기 항목에 aria-current 를 주고 summary 를 강조한다.
 */
type Destination = { label: string; href: string; icon: React.ReactNode; active: (path: string) => boolean };

const icon = (d: React.ReactNode) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const isCourseWizard = (path: string) => /\/(INTRO[1-5]|FOCUS)$/.test(path);
const isKpop = (path: string) => (path.includes('KPOP') && !path.includes('SAVED_ITEMS')) || path === '/view/kpop' || path.startsWith('/travel/kpop');

export const KRIDE_TABS: Destination[] = [
    { label: '홈', href: '/', active: (p) => p === '/' || p === '/view/MAIN_PAGE',
        icon: icon(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></>) },
    { label: '탐색', href: '/view/TOUR_EXPLORE', active: (p) => p.startsWith('/view/TOUR_EXPLORE') || p.startsWith('/travel/food') || p.startsWith('/view/CONTENT'),
        icon: icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>) },
    { label: '코스 만들기', href: '/view/ROUTE_PLANNER', active: (p) => p === '/view/ROUTE_PLANNER' || isCourseWizard(p),
        icon: icon(<><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></>) },
    { label: 'K-POP', href: '/view/kpop', active: isKpop,
        icon: icon(<><path d="M12 3v12" /><circle cx="9" cy="17" r="3" /><path d="M12 3c2 1 5 1 7 3" /></>) },
    { label: '마이', href: '/view/MY_PAGE', active: (p) => p === '/view/MY_PAGE' || p === '/view/LOGIN_PAGE' || p.includes('SAVED_ITEMS'),
        icon: icon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>) },
];

// 2026-10-21 운영 결정: 커뮤니티·시간 설정·개인정보 설정은 우선 숨긴다(display:none). 되살릴 때 `hidden` 만 지우면 된다.
// 기록: ME 저장소 01-History/2026-10-21_KMovement_내비_커뮤니티_시간설정_개인정보설정_숨김/README.md
const MORE: { label: string; href: string; active?: (path: string) => boolean; hidden?: boolean }[] = [
    { label: '아티스트 코스 만들기 (5단계)', href: '/view/INTRO1' },
    { label: '여행봇', href: '/view/CHAT', active: (p) => p === '/view/CHAT' || p.includes('KRIDE_CHAT') },
    { label: '언어 채팅', href: '/view/AI_ENGLISH_CHAT_PAGE', active: (p) => p.includes('CHAT_PAGE') },
    { label: '전국 맛집', href: '/travel/food' },
    { label: '커뮤니티', href: '/view/COMMUNITY_LIST', active: (p) => p.includes('COMMUNITY'), hidden: true },
    { label: '시간 설정', href: '/view/SET_TIME_PAGE', active: (p) => p === '/view/SET_TIME_PAGE', hidden: true },
];

export default function KrideNav() {
    const path = usePathname() || '/';
    const more = useRef<HTMLDetailsElement>(null);
    useEffect(() => { if (more.current) more.current.open = false; }, [path]);

    const activeTab = KRIDE_TABS.find((tab) => tab.active(path));
    const activeMore = activeTab ? undefined : MORE.find((item) => !item.hidden && item.active?.(path));

    return (
        <header className="kride-site-header">
            <Link className="kride-brand" href="/">KRIDE</Link>
            <nav aria-label="주요 메뉴">
                {KRIDE_TABS.map((tab) => (
                    <Link key={tab.href} href={tab.href} aria-current={tab === activeTab ? 'page' : undefined}>
                        <span className="kride-tab-icon">{tab.icon}</span>
                        <span className="kride-tab-label">{tab.label}</span>
                    </Link>
                ))}
                <details ref={more} className={`kride-more${activeMore ? ' kride-more--active' : ''}`}>
                    <summary>
                        <span className="kride-tab-icon">{icon(<><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>)}</span>
                        <span className="kride-tab-label">더보기</span>
                    </summary>
                    <div>
                        {MORE.map((item) => (
                            <Link key={item.href} href={item.href} aria-current={item === activeMore ? 'page' : undefined} hidden={item.hidden} className={item.hidden ? 'kride-entry-hidden' : undefined}>{item.label}</Link>
                        ))}
                        <span hidden className="kride-entry-hidden"><PrivacySettingsButton variant="menu" /></span>
                    </div>
                </details>
            </nav>
        </header>
    );
}
