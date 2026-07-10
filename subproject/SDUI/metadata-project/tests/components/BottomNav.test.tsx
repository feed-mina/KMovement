import React from 'react';
import { render, screen } from '@testing-library/react';
import BottomNav from '@/components/layout/BottomNav';

// BottomNav가 의존하는 훅들을 결정적으로 모킹
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
    usePathname: () => '/view/CONTENT_LIST',
    useRouter: () => ({ push: mockPush }),
}));

let mockDevice = { isMobile: true };
jest.mock('@/hooks/useDeviceType', () => ({
    useDeviceType: () => mockDevice,
}));

let mockAuth: { isLoggedIn: boolean; user: { role: string } | null } = {
    isLoggedIn: true,
    user: { role: 'ROLE_USER' },
};
jest.mock('@/context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

describe('BottomNav — 관광 IA 리프레임', () => {
    beforeEach(() => {
        mockDevice = { isMobile: true };
        mockAuth = { isLoggedIn: true, user: { role: 'ROLE_USER' } };
        mockPush.mockClear();
    });

    it('관광 라벨(탐색·동선·통역·커뮤니티·마이)을 렌더링해야 함', () => {
        render(<BottomNav />);
        ['탐색', '동선', '통역', '커뮤니티', '마이'].forEach(label => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });

    it('구 라벨(콘텐츠·약속·AI 채팅)은 더 이상 없어야 함', () => {
        render(<BottomNav />);
        ['콘텐츠', '약속', 'AI 채팅'].forEach(label => {
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        });
    });

    it('PC(비모바일)에서는 렌더링하지 않아야 함', () => {
        mockDevice = { isMobile: false };
        const { container } = render(<BottomNav />);
        expect(container).toBeEmptyDOMElement();
    });

    it('어드민 역할에는 일반 탭을 숨겨야 함', () => {
        mockAuth = { isLoggedIn: true, user: { role: 'ROLE_ADMIN' } };
        const { container } = render(<BottomNav />);
        expect(container).toBeEmptyDOMElement();
    });

    it('비로그인 상태에서는 렌더링하지 않아야 함', () => {
        mockAuth = { isLoggedIn: false, user: null };
        const { container } = render(<BottomNav />);
        expect(container).toBeEmptyDOMElement();
    });
});
