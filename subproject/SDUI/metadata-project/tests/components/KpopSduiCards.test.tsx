import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

    it('uploads a consented image and routes the AI job result internally', async () => {
        const onAction = jest.fn();
        const fetchMock = jest.spyOn(global, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { sourceKey: 'kpop/user/source.webp', uploadUrl: 'https://upload.example/source' },
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: { jobId: 22, status: 'QUEUED' } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'data:image/gif;base64,R0lGODlhAQABAAAAACw=') });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });

        renderWithProviders(
            <DynamicEngine
                metadata={[{ componentId: 'ai-upload', componentType: 'UPLOAD_CONSENT' }]}
                screenId="KPOP_AI_FIND"
                pageData={{}}
                formData={{}}
                onChange={jest.fn()}
                onAction={onAction}
            />,
        );

        const file = new File(['image'], 'outfit.webp', { type: 'image/webp' });
        fireEvent.change(screen.getByLabelText(/사진 선택/), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: '후보 분석 시작' }));

        await waitFor(() => expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({ actionUrl: '/view/KPOP_AI_RESULT?jobId=22' }),
            expect.objectContaining({ jobId: 22 }),
        ));
        expect(fetchMock).toHaveBeenCalledTimes(3);
        fetchMock.mockRestore();
    });

    it('renders product candidates and only exposes rights-checked HTTPS sources', async () => {
        const fetchMock = jest.spyOn(global, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
                {
                    id: 31,
                    name: '공식 후보',
                    evidenceGrade: 'SIMILAR',
                    evidenceText: '공식 카탈로그 색상과 형태가 유사함',
                    officialUrl: 'https://shop.example/product/31',
                    rightsChecked: true,
                },
                {
                    id: 32,
                    name: '미확인 후보',
                    officialUrl: 'http://unsafe.example/product/32',
                    rightsChecked: true,
                },
            ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));

        renderWithProviders(
            <DynamicEngine
                metadata={[{ componentId: 'product-search', componentType: 'PRODUCT_SEARCH' }]}
                screenId="KPOP_PRODUCTS"
                pageData={{}}
                formData={{}}
                onChange={jest.fn()}
                onAction={jest.fn()}
            />,
        );

        expect(await screen.findByRole('heading', { name: '공식 후보' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '미확인 후보' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /권리 확인된 공식 출처/ })).toHaveAttribute('href', 'https://shop.example/product/31');
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/kpop/product-candidates?limit=30'), expect.any(Object));
        fetchMock.mockRestore();
    });
});