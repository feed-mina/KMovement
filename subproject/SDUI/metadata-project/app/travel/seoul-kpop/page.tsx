import type { Metadata } from 'next';
import TravelLanding from '@/components/marketing/TravelLanding';
import { kpopGuide } from '@/lib/seo/travelContent';

export const metadata: Metadata = {
    title: '서울 K-POP 성지 여행 가이드',
    description: '홍대, 성수, 잠실 등 서울 K-POP 여행 권역을 이동하기 좋은 하루 동선으로 계획해 보세요.',
    alternates: { canonical: '/travel/seoul-kpop' },
    openGraph: { url: '/travel/seoul-kpop', title: '서울 K-POP 성지 여행 가이드 | KRIDE', description: kpopGuide.description },
};

export default function SeoulKpopPage() { return <TravelLanding content={kpopGuide} path="/travel/seoul-kpop" />; }
