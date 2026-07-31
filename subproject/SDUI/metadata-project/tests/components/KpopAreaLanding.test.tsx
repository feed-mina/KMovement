import React from 'react';
import { render, screen, within } from '@testing-library/react';
import KpopAreaLanding from '@/components/marketing/KpopAreaLanding';
import KpopHubLanding from '@/components/marketing/KpopHubLanding';
import { findKpopArea, kpopAreas } from '@/lib/seo/travelContent';

jest.mock('@/lib/analytics/dataLayer', () => ({ trackEvent: jest.fn() }));

describe('K-POP 허브', () => {
    it('등록된 지역만 각자의 페이지로 링크한다', () => {
        render(<KpopHubLanding />);
        kpopAreas.forEach((area) => {
            const link = screen.getByRole('link', { name: `${area.name} K-POP ${area.tagline} 권역 ${area.highlights.length} · 성지 ${area.holySpots.length}` });
            expect(link).toHaveAttribute('href', `/travel/kpop/${area.slug}`);
        });
    });

    it('페이지가 없는 지역은 탐색 화면으로 안내한다', () => {
        render(<KpopHubLanding />);
        expect(screen.getByText(/아직 페이지가 없는 지역의 성지는/)).toBeInTheDocument();
    });
});

describe('K-POP 시·도 페이지', () => {
    const seoul = findKpopArea('seoul')!;

    it('권역과 성지 섹션을 렌더하고 탐색 링크에 지역 코드를 싣는다', () => {
        render(<KpopAreaLanding area={seoul} />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('서울 K-POP 성지');
        seoul.highlights.forEach((highlight) => {
            expect(screen.getByRole('heading', { name: highlight.name })).toBeInTheDocument();
        });
        seoul.holySpots.forEach((spot) => {
            expect(screen.getByRole('heading', { name: spot.name })).toBeInTheDocument();
        });
        screen.getAllByRole('link', { name: /탐색/ }).forEach((link) => {
            expect(link).toHaveAttribute('href', `/view/TOUR_EXPLORE?area=${seoul.areaCode}`);
        });
    });

    it('spots 없이 렌더하면 에디터 추천으로 표시한다', () => {
        render(<KpopAreaLanding area={seoul} />);

        expect(screen.getByText(/에디터 추천 ·/)).toBeInTheDocument();
        expect(screen.getByText(/성지 데이터를 불러오지 못해/)).toBeInTheDocument();
        // 이미지가 없는 큐레이션 목록에는 썸네일 자리를 만들지 않는다.
        expect(screen.queryByRole('img', { name: /이미지 없음/ })).toBeNull();
    });

    it('성지 DB 응답을 받으면 출처 표기와 썸네일을 함께 보여준다', () => {
        render(
            <KpopAreaLanding
                area={seoul}
                spots={{
                    holySpots: [
                        { key: 'a', name: '홍대 걷고싶은거리', tag: 'BTS', district: '마포구', body: '버스킹이 자주 열립니다.', image: 'https://tong.visitkorea.or.kr/h.jpg' },
                        { key: 'b', name: '이미지 없는 성지', tag: '드라마 촬영지', district: '송파구', body: '설명' },
                    ],
                    holySource: 'tourapi',
                }}
            />,
        );

        expect(screen.getByText(/성지 DB 연동 · 2곳/)).toBeInTheDocument();
        expect(screen.getByAltText('홍대 걷고싶은거리')).toHaveAttribute('src', 'https://tong.visitkorea.or.kr/h.jpg');
        expect(screen.getByRole('img', { name: '이미지 없는 성지 이미지 없음' })).toBeInTheDocument();
    });

    it('시·군·구를 링크가 아닌 목록으로만 보여준다', () => {
        render(<KpopAreaLanding area={seoul} />);

        const list = screen.getByRole('list', { name: '서울 시·군·구 목록' });
        expect(within(list).getAllByRole('listitem').map((n) => n.textContent)).toEqual(seoul.districts);
        expect(within(list).queryAllByRole('link')).toHaveLength(0);
    });

    it('허브와 인접 지역으로 되돌아가는 내부 링크를 둔다', () => {
        render(<KpopAreaLanding area={seoul} />);

        expect(screen.getAllByRole('link', { name: 'K-POP 여행' })[0]).toHaveAttribute('href', '/travel/kpop');
        seoul.neighbors.forEach((slug) => {
            const neighbor = findKpopArea(slug)!;
            expect(screen.getByRole('link', { name: `${neighbor.name} K-POP` })).toHaveAttribute('href', `/travel/kpop/${slug}`);
        });
    });
});
