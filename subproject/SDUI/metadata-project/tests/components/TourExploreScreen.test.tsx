import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TourExploreScreen from '@/components/plugins/travel/TourExploreScreen';
import { fetchTourPois } from '@/services/tourApi';

jest.mock('@/services/tourApi', () => ({
    __esModule: true,
    fetchTourPois: jest.fn(),
}));

const mockedFetch = fetchTourPois as jest.Mock;

const sample = [
    { contentId: '1', title: '가나돈까스의집', addr: '서울 강남구', firstImage: 'http://img/a.jpg', mapX: 127, mapY: 37.5 },
    { contentId: '2', title: '가담', addr: '서울 강남구', firstImage: '', mapX: 127.03, mapY: 37.52 },
];

describe('TourExploreScreen — [탐색] TourAPI 카드', () => {
    beforeEach(() => {
        mockedFetch.mockReset();
        mockedFetch.mockResolvedValue(sample);
    });

    const renderScreen = () => render(<TourExploreScreen screenId="TOUR_EXPLORE" refId={null} />);

    it('맛집 POI 카드를 렌더링해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가나돈까스의집')).toBeInTheDocument());
        expect(screen.getByText('가담')).toBeInTheDocument();
    });

    it('기본 카테고리는 맛집(39)으로 조회해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
        expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '1', contentTypeId: '39' }));
    });

    it('카테고리 전환 시 해당 contentTypeId로 재조회해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가담')).toBeInTheDocument());
        fireEvent.click(screen.getByText('관광지'));
        await waitFor(() =>
            expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ contentTypeId: '12' })),
        );
    });

    it('http 이미지 URL을 https로 업그레이드해야 함', async () => {
        renderScreen();
        const img = await screen.findByAltText('가나돈까스의집') as HTMLImageElement;
        expect(img.src).toBe('https://img/a.jpg');
    });

    it('조회 실패 시 안내 문구를 표시해야 함', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('network'));
        renderScreen();
        await waitFor(() => expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument());
    });
});
