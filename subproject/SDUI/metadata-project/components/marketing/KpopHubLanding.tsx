import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import TrackedLink from '@/components/analytics/TrackedLink';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/structuredData';
import { kpopAreaPath, kpopAreas, kpopChecklist, kpopHub } from '@/lib/seo/travelContent';
import styles from './marketing.module.css';

// K-POP 여행 허브(/travel/kpop).
// 맛집과 달리 공연장·성지가 실제로 모여 있는 지역만 스포크로 둔다.
export default function KpopHubLanding() {
    return (
        <main className={styles.page}>
            <JsonLd data={[
                breadcrumbJsonLd([{ name: 'KRIDE', path: '/' }, { name: kpopHub.title, path: '/travel/kpop' }]),
                itemListJsonLd(kpopHub.title, kpopAreas.map((area) => ({ name: `${area.name} K-POP 성지`, description: area.description }))),
            ]} />
            <MarketingNav />
            <header className={styles.hero}>
                <span className={styles.eyebrow}>{kpopHub.eyebrow}</span>
                <h1>{kpopHub.title}</h1>
                <p>{kpopHub.description}</p>
                <div className={styles.actions}>
                    <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={kpopHub.entryPoint}>무료로 여행 동선 만들기</TrackedLink>
                    <Link className={styles.secondaryButton} href="/view/TOUR_EXPLORE">성지 탐색하기</Link>
                </div>
            </header>
            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>지역 고르기</h2>
                    <span className={styles.sectionNote}>{kpopAreas.length}개 지역</span>
                </div>
                <p className={styles.lead}>{kpopHub.intro}</p>
                <div className={styles.areaGrid}>
                    {kpopAreas.map((area) => (
                        <Link className={styles.areaCard} href={kpopAreaPath(area.slug)} key={area.slug}>
                            <strong>{area.name} K-POP</strong>
                            <span>{area.tagline}</span>
                            <em>권역 {area.highlights.length} · 성지 {area.holySpots.length}</em>
                        </Link>
                    ))}
                </div>
                <p className={styles.sourceNote}>
                    아직 페이지가 없는 지역의 성지는 <Link href="/view/TOUR_EXPLORE">탐색 화면</Link>에서 시·도별로 볼 수 있습니다.
                </p>
            </section>
            <section className={`${styles.section} ${styles.checklist}`}>
                <h2>출발 전 체크리스트</h2>
                <ul>{kpopChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section className={styles.cta}>
                <h2>공연 일정과 체류 시간에 맞춰 코스를 만들어 보세요.</h2>
                <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={`${kpopHub.entryPoint}_bottom`}>KRIDE 시작하기</TrackedLink>
            </section>
            <footer className={styles.footer}>© KRIDE · AI K-컬처 여행 플래너</footer>
        </main>
    );
}
