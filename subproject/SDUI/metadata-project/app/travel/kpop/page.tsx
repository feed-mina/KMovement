import type { Metadata } from 'next';
import KpopHubLanding from '@/components/marketing/KpopHubLanding';
import { kpopHub } from '@/lib/seo/travelContent';

export const metadata: Metadata = {
    title: 'K-POP 성지 여행 코스 가이드',
    description: '서울, 경기, 인천, 부산, 강원, 대구의 K-POP 권역과 성지를 지역별로 확인해 보세요.',
    alternates: { canonical: '/travel/kpop' },
    openGraph: { url: '/travel/kpop', title: 'K-POP 성지 여행 코스 가이드 | KRIDE', description: kpopHub.description },
};

export default function KpopHubPage() { return <KpopHubLanding />; }
