import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AppShell from '@/components/layout/AppShell';

jest.mock('next/navigation', () => ({
    usePathname: () => '/view/MAIN_PAGE',
}));

jest.mock('@/hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: false, deviceClass: 'is-pc' }),
}));

jest.mock('@/components/layout/Sidebar', () => ({
    __esModule: true,
    default: ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => (
        <button type="button" aria-expanded={!collapsed} onClick={onToggle}>
            sidebar
        </button>
    ),
}));

jest.mock('@/components/layout/Header', () => () => null);
jest.mock('@/components/layout/BottomNav', () => () => null);
jest.mock('@/components/fields/RecordTimeComponent', () => () => null);
jest.mock('@/components/layout/ServiceWorkerUpdater', () => () => null);
jest.mock('@/components/layout/FocusFooterBar', () => () => null);

describe('AppShell desktop sidebar', () => {
    it('toggles the sidebar when its logo control is clicked', () => {
        render(<AppShell><div>content</div></AppShell>);

        const toggle = screen.getByRole('button', { name: 'sidebar' });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });
});
