import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import TrackedLink from '@/components/analytics/TrackedLink';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/structuredData';
import {
    findFoodArea,
    foodAreaEntryPoint,
    foodAreaPath,
    foodChecklist,
    type FoodAreaGuide,
} from '@/lib/seo/travelContent';
import styles from './marketing.module.css';

// 시·도 맛집 페이지(/travel/food/{slug}).
// 시·군·구는 별도 페이지를 만들지 않고, 목록 표시 + TOUR_EXPLORE 필터로 넘긴다.
export default function FoodAreaLanding({ area }: { area: FoodAreaGuide }) {
    const path = foodAreaPath(area.slug);
    const neighbors = area.neighbors
        .map((slug) => findFoodArea(slug))
        .filter((neighbor): neighbor is FoodAreaGuide => Boolean(neighbor));

    return (
        <main className={styles.page}>
            <JsonLd data={[
                breadcrumbJsonLd([
                    { name: 'KRIDE', path: '/' },
                    { name: '전국 맛집', path: '/travel/food' },
                    { name: `${area.name} 맛집`, path },
                ]),
                itemListJsonLd(`${area.name} 맛집 권역`, area.highlights),
            ]} />
            <MarketingNav />
            <p className={styles.crumb}>
                <Link href="/travel/food">전국 맛집</Link>
                {' › '}
                {area.name}
            </p>
            <header className={styles.hero}>
                <span className={styles.eyebrow}>{area.fullName} 맛집 여행 가이드</span>
                <h1>{area.name} 맛집, {area.tagline}</h1>
                <p>{area.description}</p>
                <div className={styles.actions}>
                    <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={foodAreaEntryPoint(area.slug)}>무료로 여행 동선 만들기</TrackedLink>
                    <Link className={styles.secondaryButton} href="/view/TOUR_EXPLORE">{area.name} 탐색하기</Link>
                </div>
            </header>

            <section className={styles.section}>
                <h2>권역별 동선</h2>
                <p className={styles.lead}>{area.intro}</p>
                <div className={styles.cardGrid}>
                    {area.highlights.map((highlight) => (
                        <article className={styles.card} key={highlight.name}>
                            <h3>{highlight.name}</h3>
                            <p>{highlight.description}</p>
                            <small>{highlight.tip}</small>
                        </article>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>{area.name} 대표 맛집</h2>
                    <span className={styles.sectionNote}>{area.signatureSpots.length}곳</span>
                </div>
                <div className={styles.spotGrid}>
                    {area.signatureSpots.map((spot) => (
                        <article className={styles.spot} key={spot.name}>
                            <div className={styles.spotMeta}>
                                <span className={styles.tag}>{spot.category}</span>
                                <span className={styles.spotWhere}>{spot.district}</span>
                            </div>
                            <h3>{spot.name}</h3>
                            <p>{spot.reason}</p>
                        </article>
                    ))}
                </div>
                <p className={styles.sourceNote}>
                    각 장소의 영업시간과 휴무일은 방문 전 공식 채널에서 확인하세요. 실시간 목록은 탐색 화면에서 시·군·구별로 볼 수 있습니다.
                </p>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>{area.name} 성지 맛집</h2>
                    <span className={styles.sectionNote}>작품·아티스트 연결</span>
                </div>
                <div className={styles.spotGrid}>
                    {area.holySpots.map((spot) => (
                        <article className={styles.spot} key={spot.name}>
                            <div className={styles.spotMeta}>
                                <span className={`${styles.tag} ${styles.holyTag}`}>{spot.content}</span>
                                <span className={styles.spotWhere}>{spot.district}</span>
                            </div>
                            <h3>{spot.name}</h3>
                            <p>{spot.note}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>{area.name} 시·군·구</h2>
                    <span className={styles.sectionNote}>{area.districts.length}개 지역</span>
                </div>
                <p className={styles.lead}>탐색 화면에서 아래 지역으로 좁혀 실시간 맛집과 성지를 볼 수 있습니다.</p>
                <ul className={styles.districtList} aria-label={`${area.name} 시·군·구 목록`}>
                    {area.districts.map((district) => <li key={district}>{district}</li>)}
                </ul>
            </section>

            <section className={`${styles.section} ${styles.checklist}`}>
                <h2>출발 전 체크리스트</h2>
                <ul>{foodChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>

            {neighbors.length > 0 && (
                <section className={styles.section}>
                    <h2>가까운 지역 맛집</h2>
                    <div className={styles.related}>
                        {neighbors.map((neighbor) => (
                            <Link href={foodAreaPath(neighbor.slug)} key={neighbor.slug}>{neighbor.name} 맛집</Link>
                        ))}
                        <Link href="/travel/food">전국 맛집 전체 보기</Link>
                    </div>
                </section>
            )}

            <section className={styles.cta}>
                <h2>{area.name} 일정에 맞춰 코스를 만들어 보세요.</h2>
                <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={foodAreaEntryPoint(area.slug, 'bottom')}>KRIDE 시작하기</TrackedLink>
            </section>
            <footer className={styles.footer}>© KRIDE · AI K-컬처 여행 플래너</footer>
        </main>
    );
}
