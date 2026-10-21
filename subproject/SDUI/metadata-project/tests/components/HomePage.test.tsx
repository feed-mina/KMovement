import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import HomePage from '@/app/page';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/' }));

beforeEach(() => {
    global.fetch = jest.fn((url: string) => Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: { totalCount: String(url).includes('artists') ? 30 : 12, items: [] } }),
    } as unknown as Response)) as unknown as typeof fetch;
});

// 벤치마킹 H3 체크리스트: Primary 1개 · 첫 화면에 입력할 것 1개 · 타일에 실제 수량 · 하단 반복 CTA 없음
test('hero has one primary button and one search input; the bottom repeat CTA is gone', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelectorAll('.primaryButton')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '조건만 고르고 코스 받기' })).toHaveAttribute('href', '/view/ROUTE_PLANNER');
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.queryByText('KRIDE 시작하기')).toBeNull();
    expect(screen.queryByText('여행지 먼저 둘러보기')).toBeNull();
});

test('category tiles link to the four public destinations and show live counts when the API answers', async () => {
    const { container } = render(<HomePage />);
    // 상단 내비에도 같은 href 가 있으므로 타일만 본다
    const tile = (href: string) => Array.from(container.querySelectorAll('a.tile')).find((link) => link.getAttribute('href') === href);
    expect(tile('/view/TOUR_EXPLORE?category=HOLY')).toHaveTextContent('성지');
    expect(tile('/travel/food')).toHaveTextContent('17개 시·도 가이드');
    await waitFor(() => expect(tile('/view/kpop')).toHaveTextContent('아티스트30팀'));
    await waitFor(() => expect(tile('/view/KPOP_EVENTS')).toHaveTextContent('팬 일정다가오는 12건'));
});

test('popular areas reuse the real guide counts and link to the area pages', () => {
    render(<HomePage />);
    const seoul = screen.getByRole('link', { name: /^서울 시장과 골목을 한 코스로 권역 \d+ · 맛집 \d+ · 성지 \d+$/ });
    expect(seoul).toHaveAttribute('href', '/travel/food/seoul');
    expect(screen.getByRole('link', { name: '17개 시·도 전체 →' })).toHaveAttribute('href', '/travel/food');
});
