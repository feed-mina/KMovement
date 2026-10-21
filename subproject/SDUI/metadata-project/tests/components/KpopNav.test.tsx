import React from 'react';
import { render, screen } from '@testing-library/react';
import KpopNav from '@/components/plugins/kpop/KpopNav';

let mockPath = '/view/kpop';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));

// 벤치마킹 H6: 서브 메뉴는 탭 3개 + 카운트, 5단계 위자드 링크는 더보기 메뉴로 갔다
test('shows three tabs with counts only for numbers the screen knows', () => {
    render(<KpopNav counts={{ artists: 30, events: undefined }} />);
    expect(screen.getByRole('link', { name: '아티스트 30' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '이벤트' })).toHaveAttribute('href', '/view/KPOP_EVENTS');
    expect(screen.getByRole('link', { name: '상품' })).toHaveAttribute('href', '/view/KPOP_PRODUCTS');
    expect(screen.queryByRole('link', { name: /코스 만들기/ })).toBeNull();
});

test('marks the events tab on event screens', () => {
    mockPath = '/view/KPOP_EVENTS';
    render(<KpopNav counts={{ events: 12 }} />);
    expect(screen.getByRole('link', { name: '이벤트 12' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '아티스트' })).not.toHaveAttribute('aria-current');
});
