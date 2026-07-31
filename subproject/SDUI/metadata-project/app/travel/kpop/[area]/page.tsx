import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KpopAreaLanding from '@/components/marketing/KpopAreaLanding';
import { loadAreaKpopSpots } from '@/lib/seo/kpopAreaSpots';
import { findKpopArea, kpopAreaPath, kpopAreas } from '@/lib/seo/travelContent';

type PageProps = { params: Promise<{ area: string }> };

// 등록된 지역만 빌드 타임에 생성하고, 그 외 slug는 404로 보낸다.
export const dynamicParams = false;

// 성지 목록을 한 시간 주기로 갱신한다. 조회에 실패하면 정적 큐레이션이 그대로 남는다.
export const revalidate = 3600;

export function generateStaticParams() {
    return kpopAreas.map((area) => ({ area: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { area: slug } = await params;
    const area = findKpopArea(slug);
    if (!area) return {};

    const title = `${area.name} K-POP 성지 여행 코스 가이드`;
    const path = kpopAreaPath(area.slug);
    return {
        title,
        description: area.description,
        alternates: { canonical: path },
        openGraph: { url: path, title: `${title} | KRIDE`, description: area.description },
    };
}

export default async function KpopAreaPage({ params }: PageProps) {
    const { area: slug } = await params;
    const area = findKpopArea(slug);
    if (!area) notFound();
    const spots = await loadAreaKpopSpots(area);
    return <KpopAreaLanding area={area} spots={spots} />;
}
