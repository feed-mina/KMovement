import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SduiScreen from '@/components/screens/SduiScreen';

jest.mock('@/components/screens/useScreenGuard', () => ({
    useScreenGuard: () => ({ isLoading: false, blocked: false }),
}));

jest.mock('@/components/screens/useSduiScreen', () => ({
    useSduiScreen: (_screenId: string, _refId: string | number | null, opts?: { currentPage?: number; pageSize?: number }) => {
        const artists = Array.from({ length: 9 }, (_, index) => ({
            id: index + 1,
            nameKo: `ARTIST ${index + 1}`,
            nameEn: `ARTIST ${index + 1}`,
        }));
        const currentPage = opts?.currentPage ?? 1;
        const pageSize = opts?.pageSize ?? 8;
        return {
            metadata: [],
            pageData: {
                artists: artists.slice((currentPage - 1) * pageSize, currentPage * pageSize),
            },
            totalCount: artists.length,
            loading: false,
            formData: {},
            setFormData: jest.fn(),
            handleChange: jest.fn(),
            handleAction: jest.fn(),
            showPassword: false,
            pwType: 'password',
            activeModal: null,
            closeModal: jest.fn(),
        };
    },
}));

jest.mock('@/components/screens/SduiRenderer', () => ({
    __esModule: true,
    default: ({ pageData }: any) => (
        <div data-testid="kpop-artists">
            {(pageData?.artists || []).map((artist: any) => (
                <div key={artist.id} data-testid="artist-item">{artist.nameKo}</div>
            ))}
        </div>
    ),
}));

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('KPOP_EXPLORE pagination', () => {
    it('shows 8 artists per page and paginates to the next page', async () => {
        render(<SduiScreen screenId="KPOP_EXPLORE" refId={null} />, { wrapper });

        await waitFor(() => {
            expect(screen.getAllByTestId('artist-item')).toHaveLength(8);
        });

        expect(screen.getByText('ARTIST 1')).toBeInTheDocument();
        expect(screen.getByText('ARTIST 8')).toBeInTheDocument();
        expect(screen.queryByText('ARTIST 9')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '다음' }));

        await waitFor(() => expect(screen.getByText('ARTIST 9')).toBeInTheDocument());
    });
});
