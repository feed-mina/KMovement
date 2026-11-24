'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

interface Props {
    /** 화면이 이미 알고 있는 수량만 넘긴다. 없으면 숫자 자리를 비운다 (벤치마킹 H6: 탭 + 카운트). */
    counts?: { artists?: number; events?: number; products?: number };
}

const TABS = [
    { key: 'artists', label: '아티스트', href: '/view/kpop', active: (path: string) => path === '/view/kpop' || path.includes('ARTIST') || path.includes('EXPLORE') },
    { key: 'events', label: '이벤트', href: '/view/KPOP_EVENTS', active: (path: string) => path.includes('EVENT') },
    { key: 'products', label: '상품', href: '/view/KPOP_PRODUCTS', active: (path: string) => path.includes('PRODUCT') },
] as const;

export default function KpopNav({ counts }: Props) {
    const path = usePathname() || '';
    return (
        <nav className="kpop-section-nav" aria-label="K-pop 탐색">
            {TABS.map((tab) => {
                const count = counts?.[tab.key];
                const active = tab.active(path);
                return (
                    <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}>
                        {/* 탐색 화면 분류 탭과 같은 방식: 같은 이름표를 붙인 띠가 선택한 탭으로 미끄러진다. */}
                        {active && <motion.span aria-hidden="true" className="kride-tab-indicator" layoutId="kpop-section-indicator" transition={{ duration: 0.2 }} />}
                        {tab.label}
                        {Number.isInteger(count) && <span className="kpop-section-nav__count">{count}</span>}
                    </Link>
                );
            })}
        </nav>
    );
}
