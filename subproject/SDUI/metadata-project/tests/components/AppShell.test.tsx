import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AppShell from '@/components/layout/AppShell';

let mockPath='/view/admin/THEME_SETTINGS';
jest.mock('next/navigation', () => ({
    usePathname: () => mockPath,
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

describe('AppShell admin desktop sidebar', () => {
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

it('customer pages share navigation without the legacy sidebar',()=>{mockPath='/view/kpop';render(<AppShell><div>customer content</div></AppShell>);expect(screen.getByRole('navigation',{name:'주요 메뉴'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'sidebar'})).toBeNull();expect(screen.getByText('customer content')).toBeInTheDocument()});
