import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import TrackedLink from '@/components/analytics/TrackedLink';
import JsonLd from '@/components/seo/JsonLd';
import { webApplicationJsonLd, websiteJsonLd } from '@/lib/seo/structuredData';
import styles from '@/components/marketing/marketing.module.css';

export const metadata: Metadata = {
    title: 'AI K-컬처 여행 플래너',
    description: 'K-POP 성지와 전국 맛집을 찾고 취향에 맞는 여행 동선을 무료로 만들어 보세요.',
    alternates: { canonical: '/' },
    openGraph: { url: '/', title: 'KRIDE | AI K-컬처 여행 플래너', description: 'K-POP 성지와 전국 맛집을 연결하는 나만의 여행 동선' },
};

export default function HomePage() {
    return (
        <main className={styles.page}>
            <JsonLd data={[websiteJsonLd(), webApplicationJsonLd()]} />
            <MarketingNav />
            <header className={styles.hero}>
                <span className={styles.eyebrow}>AI K-컬처 여행 플래너</span>
                <h1>좋아하는 K-컬처를 따라<br />서울을 여행하세요.</h1>
                <p>성지와 맛집을 탐색하고, 취향·지역·체류 시간에 맞는 이동 동선을 한 번에 만듭니다.</p>
                <div className={styles.actions}>
                    <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint="seo_home_hero">무료로 여행 동선 만들기</TrackedLink>
                    <Link className={styles.secondaryButton} href="/view/TOUR_EXPLORE">여행지 먼저 둘러보기</Link>
                </div>
            </header>
            <section className={styles.section}>
                <h2>어떤 여행을 찾고 있나요?</h2>
                <div className={styles.cardGrid}>
                    <article className={styles.card}><h3>서울 K-POP 성지</h3><p>홍대, 성수, 잠실의 공연·팝업·굿즈 탐색 동선을 준비합니다.</p><Link href="/travel/seoul-kpop">K-POP 여행 가이드 보기 →</Link></article>
                    <article className={styles.card}><h3>전국 맛집 코스</h3><p>17개 시·도의 시장과 골목, 카페를 이동 부담이 적은 하루 코스로 연결합니다.</p><Link href="/travel/food">전국 맛집 가이드 보기 →</Link></article>
                    <article className={styles.card}><h3>나만의 AI 동선</h3><p>지역, 여행 목적, 기간을 선택하고 맞춤형 방문 순서를 추천받습니다.</p><TrackedLink href="/view/ROUTE_PLANNER" entryPoint="seo_home_card">AI 코스 만들기 →</TrackedLink></article>
                </div>
            </section>
            <section className={styles.cta}><h2>검색부터 이동 순서까지, KRIDE에서 한 번에 시작하세요.</h2><TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint="seo_home_bottom">KRIDE 시작하기</TrackedLink></section>
            <footer className={styles.footer}>© KRIDE · AI K-컬처 여행 플래너</footer>
        </main>
    );
}
