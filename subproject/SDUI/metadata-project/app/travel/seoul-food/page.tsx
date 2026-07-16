import type { Metadata } from 'next';
import TravelLanding from '@/components/marketing/TravelLanding';
import { foodGuide } from '@/lib/seo/travelContent';

export const metadata: Metadata = {
    title: '서울 맛집 여행 코스 가이드',
    description: '광장시장, 망원, 을지로 등 서울 먹거리 권역을 시장과 카페까지 이어지는 여행 동선으로 계획해 보세요.',
    alternates: { canonical: '/travel/seoul-food' },
    openGraph: { url: '/travel/seoul-food', title: '서울 맛집 여행 코스 가이드 | KRIDE', description: foodGuide.description },
};

export default function SeoulFoodPage() { return <TravelLanding content={foodGuide} path="/travel/seoul-food" />; }
