'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useDeviceType } from '@/hooks/useDeviceType';

interface NavTab {
    label: string;
    url: string;
    // 활성 판정: 정확 일치 또는 prefix 매칭용 후보
    match: (pathname: string) => boolean;
    icon: React.ReactNode;
}

const iconProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

const TABS: NavTab[] = [
    {
        label: '탐색',
        url: '/view/CONTENT_LIST',
        match: (p) => p.startsWith('/view/CONTENT'),
        icon: (<svg {...iconProps} aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>),
    },
    {
        label: '커뮤니티',
        url: '/view/COMMUNITY_LIST',
        match: (p) => p.startsWith('/view/COMMUNITY'),
        icon: (<svg {...iconProps} aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
    },
    {
        label: '동선',
        url: '/view/ROUTE_PLANNER',
        match: (p) => p === '/view/ROUTE_PLANNER',
        icon: (<svg {...iconProps} aria-hidden="true"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>),
    },
    {
        label: '통역',
        url: '/view/AI_ENGLISH_CHAT_PAGE',
        match: (p) => p.includes('AI_') && p.includes('CHAT'),
        icon: (<svg {...iconProps} aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>),
    },
    {
        label: '마이',
        url: '/view/MY_PAGE',
        match: (p) => p === '/view/MY_PAGE',
        icon: (<svg {...iconProps} aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
    },
];

// 모바일 전용 하단 탭 네비게이션.
// PC(사이드바)에는 존재하는 주요 네비가 모바일 Header에는 없어 이동 경로가 끊기는 문제를 해결한다.
export default function BottomNav() {
    const { isMobile } = useDeviceType();
    const pathname = usePathname();
    const router = useRouter();
    const { isLoggedIn, user } = useAuth();

    if (!isMobile) return null;
    if (!isLoggedIn) return null;
    // 어드민은 별도 도구 셸을 사용하므로 일반 사용자 탭은 숨긴다
    if (user?.role === 'ROLE_ADMIN') return null;

    return (
        <nav className="bottom-nav" aria-label="주요 메뉴">
            {TABS.map((tab) => {
                const active = pathname ? tab.match(pathname) : false;
                return (
                    <button
                        key={tab.url}
                        type="button"
                        className={`bottom-nav-item${active ? ' active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => router.push(tab.url)}
                    >
                        <span className="bottom-nav-icon">{tab.icon}</span>
                        <span className="bottom-nav-label">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
