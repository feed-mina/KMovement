import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Header from '@/components/layout/Header';

const mockHandleAction = jest.fn();
let mockAuthState: {
    user: { role: string; socialType: string } | null;
    isLoggedIn: boolean;
} = { user: null, isLoggedIn: false };

jest.mock('next/navigation', () => ({
    usePathname: () => '/view/MAIN_PAGE',
}));

jest.mock('@/hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: true }),
}));

jest.mock('@/context/AuthContext', () => ({
    useAuth: () => mockAuthState,
}));

jest.mock('@/components/DynamicEngine/hook/usePageMetadata', () => ({
    usePageMetadata: () => ({
        metadata: [
            { component_id: 'header_login_btn', label_text: '로그인' },
            { component_id: 'header_general_logout', label_text: '로그아웃' },
            { component_id: 'header_kakao_logout', label_text: '카카오 로그아웃' },
        ],
        pageData: null,
        loading: false,
    }),
}));

jest.mock('@/components/DynamicEngine/hook/usePageHook', () => ({
    usePageHook: () => ({ handleAction: mockHandleAction }),
}));

describe('Header mobile layout', () => {
    beforeEach(() => {
        mockHandleAction.mockClear();
        mockAuthState = { user: null, isLoggedIn: false };
    });

    it('orders the KRIDE logo, Rai character, and auth action in one row', () => {
        render(<Header />);

        const logo = screen.getByRole('button', { name: 'KRIDE 홈으로 이동' });
        const rai = screen.getByRole('img', { name: '라이 캐릭터' });
        const login = screen.getByRole('button', { name: '로그인' });

        expect(logo.compareDocumentPosition(rai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(rai.compareDocumentPosition(login) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        fireEvent.click(logo);
        expect(mockHandleAction).toHaveBeenCalledWith({
            actionType: 'ROUTE',
            actionUrl: '/view/MAIN_PAGE',
        });
    });

    it('keeps the logout action in the right-hand auth slot', () => {
        mockAuthState = {
            user: { role: 'ROLE_USER', socialType: 'K' },
            isLoggedIn: true,
        };

        render(<Header />);

        const rai = screen.getByRole('img', { name: '라이 캐릭터' });
        const logout = screen.getByRole('button', { name: '카카오 로그아웃' });
        expect(rai.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(logout.parentElement).toHaveClass('auth-actions');
    });
});
