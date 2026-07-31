import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FoodAreaLanding from '@/components/marketing/FoodAreaLanding';
import { loadAreaFoodSpots } from '@/lib/seo/foodAreaSpots';
import { findFoodArea, foodAreaPath, foodAreas } from '@/lib/seo/travelContent';

type PageProps = { params: Promise<{ area: string }> };

// 등록된 17개 시·도만 빌드 타임에 생성하고, 그 외 slug는 404로 보낸다.
export const dynamicParams = false;

// TourAPI 목록을 한 시간 주기로 갱신한다. 조회에 실패하면 정적 큐레이션이 그대로 남는다.
export const revalidate = 3600;

export function generateStaticParams() {
    return foodAreas.map((area) => ({ area: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { area: slug } = await params;
    const area = findFoodArea(slug);
    if (!area) return {};

    const title = `${area.name} 맛집 여행 코스 가이드`;
    const path = foodAreaPath(area.slug);
    return {
        title,
        description: area.description,
        alternates: { canonical: path },
        openGraph: { url: path, title: `${title} | KRIDE`, description: area.description },
    };
}

export default async function FoodAreaPage({ params }: PageProps) {
    const { area: slug } = await params;
    const area = findFoodArea(slug);
    if (!area) notFound();
    const spots = await loadAreaFoodSpots(area);
    return <FoodAreaLanding area={area} spots={spots} />;
}
