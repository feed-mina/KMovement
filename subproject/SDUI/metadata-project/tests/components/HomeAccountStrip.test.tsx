import React from 'react';
import { render, screen } from '@testing-library/react';
import HomeAccountStrip from '@/components/marketing/HomeAccountStrip';
import { AuthContext } from '@/context/AuthContext';

const ctx = (overrides: Partial<React.ContextType<typeof AuthContext> & object>) => ({
    user: null,
    isLoggedIn: false,
    isLoading: false,
    updateUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    ...overrides,
}) as unknown as NonNullable<React.ContextType<typeof AuthContext>>;

// 벤치마킹 H3: 서버 렌더 홈에서 로그인 전/후를 이 아일랜드만 분기한다
test('guest sees a one-line banner whose login link returns to home', () => {
    render(<AuthContext.Provider value={ctx({})}><HomeAccountStrip /></AuthContext.Provider>);
    expect(screen.getByText(/저장한 코스와 아티스트를 이어서 볼 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/view/LOGIN_PAGE?returnTo=%2F');
});

test('signed-in user gets resume links instead of the banner', () => {
    render(<AuthContext.Provider value={ctx({ isLoggedIn: true, user: { userId: 'mina', isLoggedIn: true } })}><HomeAccountStrip /></AuthContext.Provider>);
    expect(screen.getByText(/이어서 하기/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '저장한 목록' })).toHaveAttribute('href', '/view/KPOP_SAVED_ITEMS');
    expect(screen.getByRole('link', { name: '코스 만들기' })).toHaveAttribute('href', '/view/ROUTE_PLANNER');
    expect(screen.queryByRole('link', { name: '로그인' })).toBeNull();
});

test('while auth is loading (or without a provider) it keeps the space but shows nothing', () => {
    const { container, rerender } = render(<AuthContext.Provider value={ctx({ isLoading: true })}><HomeAccountStrip /></AuthContext.Provider>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<HomeAccountStrip />);
    expect(screen.queryByRole('link')).toBeNull();
});
