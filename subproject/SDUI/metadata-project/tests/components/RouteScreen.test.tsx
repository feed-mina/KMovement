import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RouteScreen from '@/components/plugins/travel/RouteScreen';
import { fetchRestaurants } from '@/services/tourApi';

// 지도 SDK 로딩을 피하기 위해 RouteMap을 스텁 처리
jest.mock('@/components/fields/kride/maps/RouteMap', () => ({
    __esModule: true,
    default: () => <div data-testid="route-map" />,
}));

jest.mock('@/services/tourApi', () => ({
    __esModule: true,
    fetchRestaurants: jest.fn(() => Promise.resolve([
        { contentId: '1', title: '가나돈까스', mapX: 127.0, mapY: 37.5 },
    ])),
}));

const mockedFetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ itinerary: [], mapData: { markers: [] } }) }),
);
// @ts-expect-error jsdom global
global.fetch = mockedFetch;

let mockAuth: { user: { socialType?: string } | null; isLoggedIn: boolean } = { user: null, isLoggedIn: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));

describe('RouteScreen — [동선] 기본/AI 코스 토글', () => {
    beforeEach(() => {
        mockedFetch.mockClear();
        (fetchRestaurants as jest.Mock).mockClear();
        mockAuth = { user: null, isLoggedIn: false };
    });

    it('로그인 여부와 관계없이 공유 버튼을 표시한다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: '공유' })).toBeInTheDocument();
    });

    it('기본은 tour 모드로 TourAPI POI를 불러와 지도를 그린다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());
        expect(fetchRestaurants).toHaveBeenCalledWith('1', 12);
        expect(mockedFetch).not.toHaveBeenCalled(); // AI는 아직 호출 안 함
    });

    it('AI 코스 클릭 시 FastAPI 일정 엔드포인트를 호출한다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());

        fireEvent.click(screen.getByText('AI 코스'));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
        expect(mockedFetch).toHaveBeenCalledWith('/kride-api/recommend/itinerary', expect.objectContaining({ method: 'POST' }));
    });

    it('AI 코스는 한 번만 요청한다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());

        fireEvent.click(screen.getByText('AI 코스'));
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByText('기본 코스'));
        fireEvent.click(screen.getByText('AI 코스'));
        expect(mockedFetch).toHaveBeenCalledTimes(1);
    });
});
