import Link from 'next/link';
import styles from './marketing.module.css';

// 마케팅(SEO) 페이지 공용 상단 내비게이션.
// 맛집 가이드가 전국으로 확장되면서 링크가 여러 페이지에 흩어지지 않도록 한 곳으로 모았다.
export default function MarketingNav() {
    return (
        <nav className={styles.nav} aria-label="주요 메뉴">
            <Link className={styles.brand} href="/">KRIDE</Link>
            <div className={styles.navLinks}>
                <Link href="/travel/kpop">K-POP 여행</Link>
                <Link href="/travel/food">전국 맛집</Link>
            </div>
        </nav>
    );
}
