import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import DynamicEngine from '@/components/DynamicEngine/DynamicEngine';
import { registerKpopPlugin } from '@/components/plugins/kpop/register';
import { renderWithProviders } from '@/tests/test-utils';

jest.mock('@/components/providers/MetadataProvider', () => ({
    useMetadata: () => ({ screenId: 'KPOP_EXPLORE', metadata: [], pageData: {} }),
}));

registerKpopPlugin();

describe('K-POP internal SDUI cards', () => {
    it('renders artist data and routes details inside metadata-project', () => {
        const onAction = jest.fn();
        renderWithProviders(
            <DynamicEngine
                metadata={[{
                    componentId: 'artist-grid',
                    componentType: 'GROUP',
                    refDataId: 'artists',
                    cssClass: 'kpop-grid',
                    children: [{ componentId: 'artist-card', componentType: 'ARTIST_CARD' }],
                }]}
                screenId="KPOP_EXPLORE"
                pageData={{ artists: [{ id: 7, nameKo: 'BTS', profile: '서울 팬 여행' }] }}
                formData={{}}
                onChange={jest.fn()}
                onAction={onAction}
            />,
        );

        expect(screen.getByRole('heading', { name: 'BTS' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '상세 보기' }));
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({
                actionType: 'ROUTE',
                actionUrl: '/view/KPOP_ARTIST_DETAIL/7',
            }),
            expect.objectContaining({ id: 7 }),
        );
    });

    it('routes event details inside metadata-project', () => {
        const onAction = jest.fn();
        renderWithProviders(
            <DynamicEngine
                metadata={[{
                    componentId: 'event-list',
                    componentType: 'GROUP',
                    refDataId: 'events',
                    cssClass: 'kpop-list',
                    children: [{ componentId: 'event-card', componentType: 'EVENT_CARD' }],
                }]}
                screenId="KPOP_EVENTS"
                pageData={{ events: [{ id: 11, titleKo: '서울 팬 이벤트', region: '서울' }] }}
                formData={{}}
                onChange={jest.fn()}
                onAction={onAction}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: '상세 보기' }));
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({ actionUrl: '/view/KPOP_EVENT_DETAIL/11' }),
            expect.objectContaining({ id: 11 }),
        );
    });
});