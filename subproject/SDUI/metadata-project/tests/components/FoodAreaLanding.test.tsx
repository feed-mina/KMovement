import React from 'react';
import { render, screen, within } from '@testing-library/react';
import FoodAreaLanding from '@/components/marketing/FoodAreaLanding';
import FoodHubLanding from '@/components/marketing/FoodHubLanding';
import { findFoodArea, foodAreas } from '@/lib/seo/travelContent';

jest.mock('@/lib/analytics/dataLayer', () => ({ trackEvent: jest.fn() }));

describe('전국 맛집 허브', () => {
    it('17개 시·도를 각자의 페이지로 링크한다', () => {
        render(<FoodHubLanding />);
        foodAreas.forEach((area) => {
            const link = screen.getByRole('link', { name: new RegExp(`^${area.name} 맛집`) });
            expect(link).toHaveAttribute('href', `/travel/food/${area.slug}`);
        });
    });
});

describe('시·도 맛집 페이지', () => {
    const busan = findFoodArea('busan')!;

    it('권역·대표 맛집·성지 맛집 섹션을 모두 렌더한다', () => {
        render(<FoodAreaLanding area={busan} />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('부산 맛집');
        busan.highlights.forEach((highlight) => {
            expect(screen.getByRole('heading', { name: highlight.name })).toBeInTheDocument();
        });
        busan.signatureSpots.forEach((spot) => {
            expect(screen.getByRole('heading', { name: spot.name })).toBeInTheDocument();
        });
        busan.holySpots.forEach((spot) => {
            expect(screen.getByRole('heading', { name: spot.name })).toBeInTheDocument();
        });
    });

    it('허브와 인접 지역으로 되돌아가는 내부 링크를 둔다', () => {
        render(<FoodAreaLanding area={busan} />);

        expect(screen.getAllByRole('link', { name: '전국 맛집' })[0]).toHaveAttribute('href', '/travel/food');
        busan.neighbors.forEach((slug) => {
            const neighbor = findFoodArea(slug)!;
            expect(screen.getByRole('link', { name: `${neighbor.name} 맛집` })).toHaveAttribute('href', `/travel/food/${slug}`);
        });
    });

    it('시·군·구를 별도 페이지가 아니라 목록으로 보여준다', () => {
        render(<FoodAreaLanding area={busan} />);

        const list = screen.getByRole('list', { name: '부산 시·군·구 목록' });
        const items = within(list).getAllByRole('listitem').map((node) => node.textContent);
        expect(items).toEqual(busan.districts);
        // 시·군·구는 별도 URL을 만들지 않으므로 링크가 아니어야 한다.
        expect(within(list).queryAllByRole('link')).toHaveLength(0);
    });

    it('breadcrumb JSON-LD에 허브를 포함한다', () => {
        const { container } = render(<FoodAreaLanding area={busan} />);
        const scripts = container.querySelectorAll('script[type="application/ld+json"]');
        const payload = Array.from(scripts).map((node) => node.textContent ?? '').join('');
        expect(payload).toContain('/travel/food');
        expect(payload).toContain('부산 맛집');
    });

    it('spots 없이 렌더하면 에디터 추천으로 표시한다', () => {
        render(<FoodAreaLanding area={busan} />);

        expect(screen.getByText(/에디터 추천 · 5곳/)).toBeInTheDocument();
        expect(screen.getByText(/실시간 목록을 불러오지 못해/)).toBeInTheDocument();
    });

    it('TourAPI 목록을 받으면 출처를 실시간으로 표시한다', () => {
        render(
            <FoodAreaLanding
                area={busan}
                spots={{
                    spots: [{ key: 'a', name: '자갈치시장', tag: '맛집', district: '중구', body: '부산광역시 중구 자갈치해안로' }],
                    spotSource: 'tourapi',
                    holySpots: [{ key: 'b', name: '청사포 조개구이', tag: '드라마 촬영지', district: '해운대구', body: '포구 구간과 붙어 있습니다.' }],
                    holySource: 'tourapi',
                }}
            />,
        );

        expect(screen.getByText(/TourAPI 실시간 · 1곳/)).toBeInTheDocument();
        expect(screen.getByText(/한국관광공사 TourAPI 음식점 정보를 한 시간 주기로 갱신/)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '자갈치시장' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '청사포 조개구이' })).toBeInTheDocument();
        // 큐레이션 항목은 실시간 목록으로 대체된다.
        expect(screen.queryByRole('heading', { name: '부평깡통야시장' })).toBeNull();
    });

    it('출발 전 체크리스트를 모든 지역에서 공유한다', () => {
        const { unmount } = render(<FoodAreaLanding area={busan} />);
        const checklistHeading = screen.getByRole('heading', { name: '출발 전 체크리스트' });
        expect(within(checklistHeading.parentElement as HTMLElement).getAllByRole('listitem').length).toBeGreaterThan(0);
        unmount();

        render(<FoodAreaLanding area={findFoodArea('jeju')!} />);
        expect(screen.getByRole('heading', { name: '출발 전 체크리스트' })).toBeInTheDocument();
    });
});
