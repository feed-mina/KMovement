import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import SpotThumbnail from '@/components/marketing/SpotThumbnail';
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
import {
    curatedHolyViews,
    curatedSpotViews,
    type AreaFoodSpots,
    type FoodSpotSource,
    type FoodSpotView,
} from '@/lib/seo/foodAreaSpots';
import styles from './marketing.module.css';

const SOURCE_LABEL: Record<FoodSpotSource, string> = {
    tourapi: 'TourAPI 실시간',
    curated: '에디터 추천',
};

function SpotList({ spots, holy }: { spots: FoodSpotView[]; holy?: boolean }) {
    // 한 장이라도 썸네일이 있으면 목록 전체에 자리를 만들어 카드 높이를 맞춘다.
    const withThumbnails = spots.some((spot) => Boolean(spot.image));

    return (
        <div className={styles.spotGrid}>
            {spots.map((spot) => (
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
                            <span className={holy ? `${styles.tag} ${styles.holyTag}` : styles.tag}>{spot.tag}</span>
                            <span className={styles.spotWhere}>{spot.district}</span>
                        </div>
                        <h3>{spot.name}</h3>
                        <p>{spot.body}</p>
                    </div>
                </article>
            ))}
        </div>
    );
}

// 시·도 맛집 페이지(/travel/food/{slug}).
// 시·군·구는 별도 페이지를 만들지 않고, 목록 표시 + TOUR_EXPLORE 필터로 넘긴다.
// spots를 넘기지 않으면 정적 큐레이션으로 렌더한다 — 서버 조회 없이도 페이지가 성립해야 한다.
export default function FoodAreaLanding({ area, spots }: { area: FoodAreaGuide; spots?: AreaFoodSpots }) {
    const path = foodAreaPath(area.slug);
    const resolved: AreaFoodSpots = spots ?? {
        spots: curatedSpotViews(area),
        spotSource: 'curated',
        holySpots: curatedHolyViews(area),
        holySource: 'curated',
    };
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
                    <Link className={styles.secondaryButton} href={`/view/TOUR_EXPLORE?area=${area.areaCode}`}>{area.name} 탐색하기</Link>
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
                    <span className={styles.sectionNote}>{SOURCE_LABEL[resolved.spotSource]} · {resolved.spots.length}곳</span>
                </div>
                <SpotList spots={resolved.spots} />
                <p className={styles.sourceNote}>
                    {resolved.spotSource === 'tourapi'
                        ? '한국관광공사 TourAPI 음식점 정보를 한 시간 주기로 갱신합니다. 영업시간과 휴무일은 방문 전 공식 채널에서 확인하세요.'
                        : '실시간 목록을 불러오지 못해 에디터 추천으로 표시하고 있습니다. 영업시간과 휴무일은 방문 전 공식 채널에서 확인하세요.'}
                </p>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>{area.name} 성지 맛집</h2>
                    <span className={styles.sectionNote}>{SOURCE_LABEL[resolved.holySource]} · 작품·아티스트 연결</span>
                </div>
                <SpotList spots={resolved.holySpots} holy />
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2>{area.name} 시·군·구</h2>
                    <span className={styles.sectionNote}>{area.districts.length}개 지역</span>
                </div>
                <p className={styles.lead}>
                    <Link href={`/view/TOUR_EXPLORE?area=${area.areaCode}`}>{area.name} 탐색 화면</Link>에서 아래 지역으로 좁혀 실시간 맛집과 성지를 볼 수 있습니다.
                </p>
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
