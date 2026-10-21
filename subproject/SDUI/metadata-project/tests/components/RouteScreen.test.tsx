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
        expect(fetchRestaurants).toHaveBeenCalledWith({ areaCode: '1', numOfRows: 12, pageNo: 1 });
        expect(mockedFetch).not.toHaveBeenCalled(); // AI는 아직 호출 안 함
    });

    it('AI 코스 클릭 시 FastAPI 일정 엔드포인트를 호출한다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());

        fireEvent.click(screen.getByText('AI 코스'));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
        expect(mockedFetch).toHaveBeenCalledWith('/api/kride/recommend/itinerary', expect.objectContaining({ method: 'POST' }));
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

// 벤치마킹 H2: 기본 코스 조회 실패는 텍스트가 아니라 공용 오류 패널 + 재시도(새로고침 없음)
describe('RouteScreen — 상태 패널', () => {
    beforeEach(() => {
        mockedFetch.mockClear();
        (fetchRestaurants as jest.Mock).mockClear();
    });

    it('기본 코스 조회 실패 시 오류 패널을 보이고 다시 시도로 복구한다', async () => {
        (fetchRestaurants as jest.Mock)
            .mockRejectedValueOnce(new Error('TourAPI down'))
            .mockResolvedValueOnce([{ contentId: '1', title: '가나돈까스', mapX: 127.0, mapY: 37.5 }]);
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('장소를 불러오지 못했어요');
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());
        expect(fetchRestaurants).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('AI 코스 서버 오류는 고른 조건을 보여주고 같은 조건으로 재시도한다', async () => {
        mockedFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) } as never);
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());
        fireEvent.click(screen.getByText('AI 코스'));
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('AI 코스를 불러오지 못했어요');
        expect(alert).toHaveTextContent('성지순례');
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
        expect(JSON.parse((mockedFetch.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual(
            JSON.parse((mockedFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string),
        );
    });
});
