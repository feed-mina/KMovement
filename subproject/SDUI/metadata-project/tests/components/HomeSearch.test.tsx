import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import HomeSearch, { resolveHomeSearch } from '@/components/marketing/HomeSearch';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/' }));

beforeEach(() => push.mockReset());

// 벤치마킹 H3: 히어로 검색 1개 — 시·도 이름은 탐색(area 코드), 그 외는 아티스트 검색
describe('resolveHomeSearch', () => {
    test.each([
        ['', '/view/TOUR_EXPLORE'],
        ['   ', '/view/TOUR_EXPLORE'],
        ['서울', '/view/TOUR_EXPLORE?area=1'],
        ['서울특별시', '/view/TOUR_EXPLORE?area=1'],
        ['제주도', '/view/TOUR_EXPLORE?area=39'],
        ['경기도', '/view/TOUR_EXPLORE?area=31'],
        ['부산', '/view/TOUR_EXPLORE?area=6'],
        ['방탄소년단', '/view/kpop?q=' + encodeURIComponent('방탄소년단')],
        ['New Jeans', '/view/kpop?q=' + encodeURIComponent('New Jeans')],
    ])('"%s" → %s', (input, expected) => {
        expect(resolveHomeSearch(input)).toBe(expected);
    });
});

test('submitting the search navigates to the resolved destination', () => {
    render(<HomeSearch />);
    fireEvent.change(screen.getByRole('searchbox', { name: '어디로 떠날까요?' }), { target: { value: '아이유' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenCalledWith('/view/kpop?q=' + encodeURIComponent('아이유'));
});

test('featured area chips link straight to the explore screen with the TourAPI code', () => {
    render(<HomeSearch />);
    expect(screen.getByRole('link', { name: '서울' })).toHaveAttribute('href', '/view/TOUR_EXPLORE?area=1');
    expect(screen.getByRole('link', { name: '제주' })).toHaveAttribute('href', '/view/TOUR_EXPLORE?area=39');
    expect(screen.getByRole('link', { name: /개 지역/ })).toHaveAttribute('href', '/travel/food');
});
