import type { Metadata } from 'next';
import FoodHubLanding from '@/components/marketing/FoodHubLanding';
import { foodHub } from '@/lib/seo/travelContent';

export const metadata: Metadata = {
    title: '전국 맛집 여행 코스 가이드',
    description: '서울, 부산, 제주 등 17개 시·도의 권역별 맛집 동선과 성지 맛집을 지역별로 확인해 보세요.',
    alternates: { canonical: '/travel/food' },
    openGraph: { url: '/travel/food', title: '전국 맛집 여행 코스 가이드 | KRIDE', description: foodHub.description },
};

export default function FoodHubPage() { return <FoodHubLanding />; }
