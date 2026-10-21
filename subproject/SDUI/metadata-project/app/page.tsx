import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import HomeSearch from '@/components/marketing/HomeSearch';
import HomeAccountStrip from '@/components/marketing/HomeAccountStrip';
import HomeLiveCount from '@/components/marketing/HomeLiveCount';
import TrackedLink from '@/components/analytics/TrackedLink';
import JsonLd from '@/components/seo/JsonLd';
import { webApplicationJsonLd, websiteJsonLd } from '@/lib/seo/structuredData';
import { foodAreaPath, foodAreas } from '@/lib/seo/travelContent';
import styles from '@/components/marketing/marketing.module.css';

export const metadata: Metadata = {
    title: 'AI K-컬처 여행 플래너',
    description: 'K-POP 성지와 전국 맛집을 찾고 취향에 맞는 여행 동선을 무료로 만들어 보세요.',
    alternates: { canonical: '/' },
    openGraph: { url: '/', title: 'KRIDE | AI K-컬처 여행 플래너', description: 'K-POP 성지와 전국 맛집을 연결하는 나만의 여행 동선' },
};

// 랜딩 홈 (벤치마킹 H3, 2026-10-20): 히어로에 검색 1개 + Primary 1개, 카테고리 타일 4, 인기 지역(실제 수), 로그인 배너.
// 같은 목적지로 가는 빨간 버튼은 히어로 하나뿐이다. 가이드 카드는 텍스트 링크로 둔다.
const FEATURED_AREA_SLUGS = ['seoul', 'busan', 'jeju', 'gangwon'];

const TILES = [
    { href: '/view/TOUR_EXPLORE?category=HOLY', icon: '🎤', title: '성지', note: '촬영지 · 공연장 · 팝업' },
    { href: '/travel/food', icon: '🍜', title: '맛집', note: `${foodAreas.length}개 시·도 가이드` },
    { href: '/view/kpop', icon: '💜', title: '아티스트', live: { url: '/api/v1/kpop/artists?q=&page=1&pageSize=1', unit: '팀', fallback: '공식 채널 모음' } },
    { href: '/view/KPOP_EVENTS', icon: '📅', title: '팬 일정', live: { url: '/api/v1/kpop/event-feed?geography=all&page=1', unit: '건', prefix: '다가오는 ', fallback: '다가오는 일정' } },
];

export default function HomePage() {
    const featured = FEATURED_AREA_SLUGS
        .map((slug) => foodAreas.find((area) => area.slug === slug))
        .filter((area): area is (typeof foodAreas)[number] => Boolean(area));

    return (
        <main className={styles.page}>
            <JsonLd data={[websiteJsonLd(), webApplicationJsonLd()]} />
            <MarketingNav />
            <header className={styles.hero}>
                <span className={styles.eyebrow}>AI K-컬처 여행 플래너</span>
                <h1>좋아하는 K-컬처를 따라<br />전국을 여행하세요.</h1>
                <p>17개 시·도의 성지와 맛집을 탐색하고, 취향·지역·체류 시간에 맞는 이동 동선을 한 번에 만듭니다.</p>
                <HomeSearch />
                <div className={styles.actions}>
                    <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint="seo_home_hero">조건만 고르고 코스 받기</TrackedLink>
                </div>
            </header>
            <HomeAccountStrip />
            <section className={styles.section}>
                <h2>무엇부터 찾아볼까요?</h2>
                <div className={styles.tileGrid}>
                    {TILES.map((tile) => (
                        <Link key={tile.href} className={styles.tile} href={tile.href}>
                            <span className={styles.tileIcon} aria-hidden="true">{tile.icon}</span>
                            <span>
                                <strong>{tile.title}</strong>
                                <span>{tile.live ? <HomeLiveCount {...tile.live} /> : tile.note}</span>
                            </span>
                        </Link>
                    ))}
                </div>
            </section>
            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>인기 지역</h2>
                    <Link className={styles.sectionNote} href="/travel/food">{foodAreas.length}개 시·도 전체 →</Link>
                </div>
                <div className={styles.areaGrid}>
                    {featured.map((area) => (
                        <Link className={styles.areaCard} href={foodAreaPath(area.slug)} key={area.slug}>
                            <strong>{area.name}</strong>
                            <span>{area.tagline}</span>
                            <em>권역 {area.highlights.length} · 맛집 {area.signatureSpots.length} · 성지 {area.holySpots.length}</em>
                        </Link>
                    ))}
                </div>
            </section>
            <section className={styles.section}>
                <h2>어떤 여행을 찾고 있나요?</h2>
                <div className={styles.cardGrid}>
                    <article className={styles.card}><h3>K-POP 성지 코스</h3><p>서울, 부산, 강원 등 공연장과 촬영지가 모인 지역의 탐색 동선을 준비합니다.</p><Link href="/travel/kpop">K-POP 여행 가이드 보기 →</Link></article>
                    <article className={styles.card}><h3>전국 맛집 코스</h3><p>17개 시·도의 시장과 골목, 카페를 이동 부담이 적은 하루 코스로 연결합니다.</p><Link href="/travel/food">전국 맛집 가이드 보기 →</Link></article>
                    <article className={styles.card}><h3>나만의 AI 동선</h3><p>지역, 여행 목적, 기간을 선택하고 맞춤형 방문 순서를 추천받습니다.</p><TrackedLink href="/view/ROUTE_PLANNER" entryPoint="seo_home_card">AI 코스 만들기 →</TrackedLink></article>
                </div>
            </section>
            <footer className={styles.footer}>© KRIDE · AI K-컬처 여행 플래너</footer>
        </main>
    );
}
