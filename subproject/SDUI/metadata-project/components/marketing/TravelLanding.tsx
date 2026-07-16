import Link from 'next/link';
import TrackedLink from '@/components/analytics/TrackedLink';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/structuredData';
import type { TravelGuideContent } from '@/lib/seo/travelContent';
import styles from './marketing.module.css';

export default function TravelLanding({ content, path }: { content: TravelGuideContent; path: string }) {
    return (
        <main className={styles.page}>
            <JsonLd data={[
                breadcrumbJsonLd([{ name: 'KRIDE', path: '/' }, { name: content.title, path }]),
                itemListJsonLd(content.title, content.highlights),
            ]} />
            <nav className={styles.nav} aria-label="주요 메뉴">
                <Link className={styles.brand} href="/">KRIDE</Link>
                <div className={styles.navLinks}>
                    <Link href="/travel/seoul-kpop">K-POP 여행</Link>
                    <Link href="/travel/seoul-food">서울 맛집</Link>
                </div>
            </nav>
            <header className={styles.hero}>
                <span className={styles.eyebrow}>{content.eyebrow}</span>
                <h1>{content.title}</h1>
                <p>{content.description}</p>
                <div className={styles.actions}>
                    <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={content.entryPoint}>무료로 여행 동선 만들기</TrackedLink>
                    <Link className={styles.secondaryButton} href="/view/TOUR_EXPLORE">여행지 탐색하기</Link>
                </div>
            </header>
            <section className={styles.section}>
                <h2>여행 동선 설계 포인트</h2>
                <p className={styles.lead}>{content.intro}</p>
                <div className={styles.cardGrid}>
                    {content.highlights.map((highlight) => (
                        <article className={styles.card} key={highlight.name}>
                            <h3>{highlight.name}</h3>
                            <p>{highlight.description}</p>
                            <small>{highlight.tip}</small>
                        </article>
                    ))}
                </div>
            </section>
            <section className={`${styles.section} ${styles.checklist}`}>
                <h2>출발 전 체크리스트</h2>
                <ul>{content.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section className={styles.cta}>
                <h2>내 취향과 체류 시간에 맞춰 코스를 만들어 보세요.</h2>
                <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={`${content.entryPoint}_bottom`}>KRIDE 시작하기</TrackedLink>
            </section>
            <footer className={styles.footer}>© KRIDE · AI K-컬처 여행 플래너</footer>
        </main>
    );
}
