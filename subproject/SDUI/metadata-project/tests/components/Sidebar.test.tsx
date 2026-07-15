import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from '@/components/layout/Sidebar';

jest.mock('next/navigation', () => ({
    usePathname: () => '/view/MAIN_PAGE',
}));

jest.mock('@/hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: false }),
}));

jest.mock('@/context/AuthContext', () => ({
    useAuth: () => ({ user: null, isLoggedIn: false }),
}));

jest.mock('@/components/DynamicEngine/hook/usePageMetadata', () => ({
    usePageMetadata: () => ({ metadata: [], pageData: null, loading: false }),
}));

jest.mock('@/components/DynamicEngine/hook/usePageHook', () => ({
    usePageHook: () => ({ handleAction: jest.fn() }),
}));

describe('Sidebar logo toggle', () => {
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
});
