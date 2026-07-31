import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Sidebar from '@/components/layout/Sidebar';

const mockHandleAction = jest.fn();

let mockPathname = '/view/MAIN_PAGE';
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: false }),
}));

let mockAuth: { user: { role?: string; socialType?: string } | null; isLoggedIn: boolean } = {
    user: null,
    isLoggedIn: false,
};
jest.mock('@/context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

jest.mock('@/components/DynamicEngine/hook/usePageMetadata', () => ({
    usePageMetadata: () => ({
        metadata: [
            { componentId: 'header_login_btn', labelText: '로그인' },
            { componentId: 'header_general_logout', labelText: '로그아웃' },
        ],
        pageData: null,
        loading: false,
    }),
}));

jest.mock('@/components/DynamicEngine/hook/usePageHook', () => ({
    usePageHook: () => ({ handleAction: mockHandleAction }),
}));

describe('Sidebar logo toggle', () => {
    beforeEach(() => {
        mockHandleAction.mockClear();
        mockPathname = '/view/MAIN_PAGE';
        mockAuth = { user: null, isLoggedIn: false };
    });

    it('exposes an accessible collapse control and invokes the toggle handler', () => {
        const onToggle = jest.fn();
        const { rerender } = render(<Sidebar collapsed={false} onToggle={onToggle} />);

        const closeButton = screen.getByRole('button', { name: '사이드바 닫기' });
        expect(closeButton).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(closeButton);
        expect(onToggle).toHaveBeenCalledTimes(1);

        rerender(<Sidebar collapsed onToggle={onToggle} />);
        expect(screen.getByRole('button', { name: '사이드바 열기' }))
            .toHaveAttribute('aria-expanded', 'false');
        expect(document.querySelector('.pc-sidebar')).toHaveClass('is-collapsed');
    });

    it('renders route items as keyboard-focusable buttons', () => {
        render(<Sidebar collapsed={false} onToggle={jest.fn()} />);

        expect(screen.getByRole('button', { name: '홈' }))
            .toHaveAttribute('aria-current', 'page');

        fireEvent.click(screen.getByRole('button', { name: '커뮤니티' }));
        expect(mockHandleAction).toHaveBeenCalledWith({
            actionType: 'ROUTE',
            actionUrl: '/view/COMMUNITY_LIST',
        });
    });

    it('로고를 누르면 접기가 아니라 홈으로 이동한다', () => {
        const onToggle = jest.fn();
        render(<Sidebar collapsed={false} onToggle={onToggle} />);

        fireEvent.click(screen.getByRole('button', { name: 'KRIDE 홈으로 이동' }));

        expect(mockHandleAction).toHaveBeenCalledWith({
            actionType: 'ROUTE',
            actionUrl: '/view/MAIN_PAGE',
        });
        // 하나의 버튼이 두 일을 하던 구조라, 로고 클릭이 사이드바를 접으면 안 된다.
        expect(onToggle).not.toHaveBeenCalled();
    });
});

describe('Sidebar — 로그인 사용자 메뉴', () => {
    beforeEach(() => {
        mockHandleAction.mockClear();
        mockPathname = '/view/TOUR_EXPLORE';
        mockAuth = { user: { role: 'ROLE_USER' }, isLoggedIn: true };
    });

    it('동행 대신 K-POP 코스를 노출한다', () => {
        render(<Sidebar collapsed={false} onToggle={jest.fn()} />);

        expect(screen.queryByRole('button', { name: '동행' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'K-POP 코스' }));
        // 코스는 흐름의 첫 단계로 들어간다.
        expect(mockHandleAction).toHaveBeenCalledWith({
            actionType: 'ROUTE',
            actionUrl: '/view/INTRO1',
        });
    });

    it('중간 단계로 바로 들어가는 길은 만들지 않는다', () => {
        // FOCUS 의 추천은 INTRO1~5 에서 모은 선택값에 기대므로, 중간 진입은 빈 추천이 된다.
        render(<Sidebar collapsed={false} onToggle={jest.fn()} />);

        expect(screen.queryByRole('list', { name: 'K-POP 코스 단계' })).toBeNull();
        ['/view/INTRO2', '/view/INTRO3', '/view/INTRO4', '/view/INTRO5', '/view/FOCUS'].forEach((url) => {
            expect(mockHandleAction).not.toHaveBeenCalledWith({ actionType: 'ROUTE', actionUrl: url });
        });
    });

    it('코스 진행 중에는 메뉴가 현재 위치로 보인다', () => {
        mockPathname = '/view/INTRO3';
        render(<Sidebar collapsed={false} onToggle={jest.fn()} />);

        expect(screen.getByRole('button', { name: 'K-POP 코스' })).toHaveAttribute('aria-current', 'page');
    });

    it('탐색과 동선은 그대로 둔다', () => {
        render(<Sidebar collapsed={false} onToggle={jest.fn()} />);

        expect(screen.getByRole('button', { name: '탐색' })).toHaveAttribute('aria-current', 'page');
        fireEvent.click(screen.getByRole('button', { name: '동선' }));
        expect(mockHandleAction).toHaveBeenCalledWith({
            actionType: 'ROUTE',
            actionUrl: '/view/ROUTE_PLANNER',
        });
    });
});
