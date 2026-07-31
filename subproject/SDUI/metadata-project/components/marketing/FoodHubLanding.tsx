import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import TrackedLink from '@/components/analytics/TrackedLink';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/structuredData';
import { foodAreaPath, foodAreas, foodChecklist, foodHub } from '@/lib/seo/travelContent';
import styles from './marketing.module.css';

// 전국 맛집 허브(/travel/food).
// 시·군·구까지 페이지를 쪼개지 않고 시·도 17개만 스포크로 두는 구조다.
export default function FoodHubLanding() {
    return (
        <main className={styles.page}>
            <JsonLd data={[
                breadcrumbJsonLd([{ name: 'KRIDE', path: '/' }, { name: foodHub.title, path: '/travel/food' }]),
                itemListJsonLd(foodHub.title, foodAreas.map((area) => ({ name: `${area.name} 맛집`, description: area.description }))),
            ]} />
            <MarketingNav />
            <header className={styles.hero}>
                <span className={styles.eyebrow}>{foodHub.eyebrow}</span>
                <h1>{foodHub.title}</h1>
                <p>{foodHub.description}</p>
                <div className={styles.actions}>
                    <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={foodHub.entryPoint}>무료로 여행 동선 만들기</TrackedLink>
                    <Link className={styles.secondaryButton} href="/view/TOUR_EXPLORE">여행지 탐색하기</Link>
                </div>
            </header>
            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>지역 고르기</h2>
                    <span className={styles.sectionNote}>17개 시·도</span>
                </div>
                <p className={styles.lead}>{foodHub.intro}</p>
                <div className={styles.areaGrid}>
                    {foodAreas.map((area) => (
                        <Link className={styles.areaCard} href={foodAreaPath(area.slug)} key={area.slug}>
                            <strong>{area.name} 맛집</strong>
                            <span>{area.tagline}</span>
                            <em>권역 {area.highlights.length} · 맛집 {area.signatureSpots.length} · 성지 {area.holySpots.length}</em>
                        </Link>
                    ))}
                </div>
            </section>
            <section className={`${styles.section} ${styles.checklist}`}>
                <h2>출발 전 체크리스트</h2>
                <ul>{foodChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section className={styles.cta}>
                <h2>가고 싶은 지역과 체류 시간에 맞춰 코스를 만들어 보세요.</h2>
                <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={`${foodHub.entryPoint}_bottom`}>KRIDE 시작하기</TrackedLink>
            </section>
            <footer className={styles.footer}>© KRIDE · AI K-컬처 여행 플래너</footer>
        </main>
    );
}
