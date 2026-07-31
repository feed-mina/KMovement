import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import SpotThumbnail from '@/components/marketing/SpotThumbnail';
import TrackedLink from '@/components/analytics/TrackedLink';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/structuredData';
import {
    findKpopArea,
    kpopAreaEntryPoint,
    kpopAreaPath,
    kpopChecklist,
    type KpopAreaGuide,
} from '@/lib/seo/travelContent';
import { curatedKpopHolyViews, type AreaKpopSpots } from '@/lib/seo/kpopAreaSpots';
import styles from './marketing.module.css';

const SOURCE_LABEL = { tourapi: '성지 DB 연동', curated: '에디터 추천' } as const;

// K-POP 시·도 페이지(/travel/kpop/{slug}).
// spots를 넘기지 않으면 정적 큐레이션으로 렌더한다 — 서버 조회 없이도 페이지가 성립해야 한다.
export default function KpopAreaLanding({ area, spots }: { area: KpopAreaGuide; spots?: AreaKpopSpots }) {
    const path = kpopAreaPath(area.slug);
    const resolved: AreaKpopSpots = spots ?? {
        holySpots: curatedKpopHolyViews(area),
        holySource: 'curated',
    };
    const neighbors = area.neighbors
        .map((slug) => findKpopArea(slug))
        .filter((neighbor): neighbor is KpopAreaGuide => Boolean(neighbor));
    const withThumbnails = resolved.holySpots.some((spot) => Boolean(spot.image));

    return (
        <main className={styles.page}>
            <JsonLd data={[
                breadcrumbJsonLd([
                    { name: 'KRIDE', path: '/' },
                    { name: 'K-POP 여행', path: '/travel/kpop' },
                    { name: `${area.name} K-POP 성지`, path },
                ]),
                itemListJsonLd(`${area.name} K-POP 권역`, area.highlights),
            ]} />
            <MarketingNav />
            <p className={styles.crumb}>
                <Link href="/travel/kpop">K-POP 여행</Link>
                {' › '}
                {area.name}
            </p>
            <header className={styles.hero}>
                <span className={styles.eyebrow}>{area.fullName} K-POP 여행 가이드</span>
                <h1>{area.name} K-POP 성지, {area.tagline}</h1>
                <p>{area.description}</p>
                <div className={styles.actions}>
                    <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={kpopAreaEntryPoint(area.slug)}>무료로 여행 동선 만들기</TrackedLink>
                    <Link className={styles.secondaryButton} href={`/view/TOUR_EXPLORE?area=${area.areaCode}`}>{area.name} 성지 탐색하기</Link>
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
                    <h2>{area.name} 성지</h2>
                    <span className={styles.sectionNote}>{SOURCE_LABEL[resolved.holySource]} · {resolved.holySpots.length}곳</span>
                </div>
                <div className={styles.spotGrid}>
                    {resolved.holySpots.map((spot) => (
                        <article className={styles.spot} key={spot.key}>
                            {withThumbnails && (
                                <SpotThumbnail
                                    src={spot.image}
                                    title={spot.name}
                                    sourceUrl={spot.imageSourceUrl}
                                    credit={spot.imageCredit}
                                />
                            )}
                            <div className={styles.spotBody}>
                                <div className={styles.spotMeta}>
                                    <span className={`${styles.tag} ${styles.holyTag}`}>{spot.tag}</span>
                                    <span className={styles.spotWhere}>{spot.district}</span>
                                </div>
                                <h3>{spot.name}</h3>
                                <p>{spot.body}</p>
                            </div>
                        </article>
                    ))}
                </div>
                <p className={styles.sourceNote}>
                    {resolved.holySource === 'tourapi'
                        ? '검수를 마친 성지 데이터를 한 시간 주기로 갱신합니다. 촬영지는 대부분 영업 중인 가게나 주민 생활공간이니 방문 예절을 지켜 주세요.'
                        : '성지 데이터를 불러오지 못해 에디터 추천으로 표시하고 있습니다. 촬영지는 대부분 영업 중인 가게나 주민 생활공간이니 방문 예절을 지켜 주세요.'}
                </p>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>{area.name} 시·군·구</h2>
                    <span className={styles.sectionNote}>{area.districts.length}개 지역</span>
                </div>
                <p className={styles.lead}>
                    <Link href={`/view/TOUR_EXPLORE?area=${area.areaCode}`}>{area.name} 탐색 화면</Link>에서 아래 지역으로 좁혀 성지를 볼 수 있습니다.
                </p>
                <ul className={styles.districtList} aria-label={`${area.name} 시·군·구 목록`}>
                    {area.districts.map((district) => <li key={district}>{district}</li>)}
                </ul>
            </section>

            <section className={`${styles.section} ${styles.checklist}`}>
                <h2>출발 전 체크리스트</h2>
                <ul>{kpopChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>

            {neighbors.length > 0 && (
                <section className={styles.section}>
                    <h2>가까운 지역 K-POP 성지</h2>
                    <div className={styles.related}>
                        {neighbors.map((neighbor) => (
                            <Link href={kpopAreaPath(neighbor.slug)} key={neighbor.slug}>{neighbor.name} K-POP</Link>
                        ))}
                        <Link href="/travel/kpop">K-POP 여행 전체 보기</Link>
                    </div>
                </section>
            )}

            <section className={styles.cta}>
                <h2>{area.name} 일정에 맞춰 코스를 만들어 보세요.</h2>
                <TrackedLink className={styles.primaryButton} href="/view/ROUTE_PLANNER" entryPoint={kpopAreaEntryPoint(area.slug, 'bottom')}>KRIDE 시작하기</TrackedLink>
            </section>
            <footer className={styles.footer}>© KRIDE · AI K-컬처 여행 플래너</footer>
        </main>
    );
}
