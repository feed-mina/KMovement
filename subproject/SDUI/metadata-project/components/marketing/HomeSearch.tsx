'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { foodAreas } from '@/lib/seo/travelContent';
import styles from './marketing.module.css';

/**
 * 랜딩 홈 히어로 검색 (벤치마킹 H3, 2026-10-20).
 * 여행 홈 4/4 가 히어로에 목적지 입력 1개를 둔다. 입력값이 시·도 이름이면 탐색 화면(TourAPI 코드)으로,
 * 아니면 아티스트 검색으로 보낸다. 칩은 인기 지역 바로가기.
 */
export const FEATURED_AREA_SLUGS = ['seoul', 'busan', 'jeju', 'gangwon', 'gyeonggi'] as const;

const AREA_SUFFIX = /(특별자치도|특별자치시|특별시|광역시|자치도|도|시)$/;

/** 입력값 → 이동할 경로. 빈 값은 탐색 화면, 시·도 이름은 탐색 + area 코드, 그 외는 아티스트 검색. */
export function resolveHomeSearch(raw: string): string {
    const query = raw.trim().replace(/\s+/g, ' ');
    if (!query) return '/view/TOUR_EXPLORE';
    const stripped = query.replace(AREA_SUFFIX, '');
    const area = foodAreas.find((item) => item.name === query || item.fullName === query || (stripped && item.name === stripped));
    if (area) return `/view/TOUR_EXPLORE?area=${area.areaCode}`;
    return `/view/kpop?q=${encodeURIComponent(query)}`;
}

export default function HomeSearch() {
    const router = useRouter();
    const [value, setValue] = useState('');
    const featured = FEATURED_AREA_SLUGS
        .map((slug) => foodAreas.find((area) => area.slug === slug))
        .filter((area): area is (typeof foodAreas)[number] => Boolean(area));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.push(resolveHomeSearch(value));
    };

    return (
        <div className={styles.search}>
            <form role="search" className={styles.searchForm} onSubmit={submit}>
                <label htmlFor="home-search" className={styles.srOnly}>어디로 떠날까요?</label>
                <input
                    id="home-search"
                    type="search"
                    value={value}
                    maxLength={60}
                    autoComplete="off"
                    placeholder="어디로 떠날까요? 지역 · 아티스트 이름"
                    onChange={(event) => setValue(event.target.value)}
                />
                <button type="submit" aria-label="검색">→</button>
            </form>
            <nav className={styles.chips} aria-label="인기 지역 바로가기">
                {featured.map((area) => (
                    <Link key={area.slug} className={styles.chip} href={`/view/TOUR_EXPLORE?area=${area.areaCode}`}>{area.name}</Link>
                ))}
                <Link className={styles.chip} href="/travel/food">+{foodAreas.length - featured.length}개 지역</Link>
            </nav>
        </div>
    );
}
