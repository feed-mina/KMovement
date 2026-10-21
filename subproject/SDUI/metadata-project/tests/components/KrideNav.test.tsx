import React from 'react';
import { render, screen } from '@testing-library/react';
import KrideNav from '@/components/layout/KrideNav';

let mockPath = '/';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));

// 벤치마킹 H0: 탭 5개 + 더보기, 활성 표시는 화면당 하나.
test.each([
    ['/', '홈'],
    ['/view/MAIN_PAGE', '홈'],
    ['/view/TOUR_EXPLORE', '탐색'],
    ['/travel/food/1', '탐색'],
    ['/view/ROUTE_PLANNER', '코스 만들기'],
    ['/view/INTRO1', '코스 만들기'],
    ['/view/FOCUS', '코스 만들기'],
    ['/view/kpop', 'K-POP'],
    ['/view/KPOP_PRODUCTS', 'K-POP'],
    ['/travel/kpop', 'K-POP'],
    ['/view/MY_PAGE', '마이'],
    ['/view/LOGIN_PAGE', '마이'],
    ['/view/KPOP_SAVED_ITEMS', '마이'],
    ['/view/AI_JAPANESE_CHAT_PAGE', '언어 채팅'],
    ['/view/COMMUNITY_LIST', '커뮤니티'],
])('one active destination at %s', (path, label) => {
    mockPath = path;
    const { container } = render(<KrideNav />);
    expect(container.querySelectorAll('[aria-current=page]')).toHaveLength(1);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
});

test('home tab and brand both go to the single home `/`', () => {
    mockPath = '/view/kpop';
    render(<KrideNav />);
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'KRIDE' })).toHaveAttribute('href', '/');
});

test('"코스 만들기" goes to the route planner and the 5-step wizard is named separately', () => {
    mockPath = '/';
    render(<KrideNav />);
    expect(screen.getByRole('link', { name: '코스 만들기' })).toHaveAttribute('href', '/view/ROUTE_PLANNER');
    expect(screen.getByRole('link', { name: '아티스트 코스 만들기 (5단계)' })).toHaveAttribute('href', '/view/INTRO1');
});

test('top-level nav has exactly five tabs plus a more menu', () => {
    mockPath = '/';
    const { container } = render(<KrideNav />);
    const tabs = Array.from(container.querySelectorAll('nav > a')).map((a) => a.textContent);
    expect(tabs).toEqual(['홈', '탐색', '코스 만들기', 'K-POP', '마이']);
    expect(container.querySelector('details.kride-more summary')).toHaveTextContent('더보기');
});

test('more menu is highlighted when the active destination lives inside it', () => {
    mockPath = '/view/AI_ENGLISH_CHAT_PAGE';
    const { container } = render(<KrideNav />);
    expect(container.querySelector('details.kride-more')).toHaveClass('kride-more--active');
    mockPath = '/view/kpop';
    expect(render(<KrideNav />).container.querySelector('details.kride-more')).not.toHaveClass('kride-more--active');
});

test('more menu closes after changing destination', () => {
    mockPath = '/';
    const { container, rerender } = render(<KrideNav />);
    const more = container.querySelector('details')!;
    more.open = true;
    mockPath = '/view/kpop';
    rerender(<KrideNav />);
    expect(more.open).toBe(false);
});
