import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RouteScreen, { legLabel } from '@/components/plugins/travel/RouteScreen';
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
    Promise.resolve({ ok: true, json: () => Promise.resolve({ itinerary: [{ day: 1, morning: { places: [{ name: '장소' }] } }], mapData: { markers: [] } }) }),
);
// @ts-expect-error jsdom global
global.fetch = mockedFetch;

let mockAuth: { user: { socialType?: string } | null; isLoggedIn: boolean } = { user: null, isLoggedIn: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth, AuthContext: require('react').createContext(undefined) }));

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
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: '코스 만들기' }));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
        expect(mockedFetch).toHaveBeenCalledWith('/api/kride/recommend/itinerary', expect.objectContaining({ method: 'POST' }));
    });

    it('AI 코스는 한 번만 요청한다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());

        fireEvent.click(screen.getByText('AI 코스'));
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: '코스 만들기' }));
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByText('기본 코스'));
        fireEvent.click(screen.getByText('AI 코스'));
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
        fireEvent.click(screen.getByRole('button', { name: '코스 만들기' }));
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
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: '코스 만들기' }));
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

// 벤치마킹 H5: 조건 카드가 항상 위에 있고 기본 코스도 지역을 쓴다 · segmented 2개 · 하단 액션 바 · 구간 이동 한 줄
describe('RouteScreen — H5 조건 → 결과', () => {
    beforeEach(() => {
        mockedFetch.mockClear();
        (fetchRestaurants as jest.Mock).mockClear();
        (fetchRestaurants as jest.Mock).mockResolvedValue([
            { contentId: '1', title: '가나돈까스', mapX: 127.0, mapY: 37.5 },
            { contentId: '2', title: '광장시장', mapX: 127.01, mapY: 37.51 },
        ]);
    });

    it('기본 코스에서 지역 칩을 바꾸면 그 지역 코드로 다시 불러온다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());
        expect(screen.getByRole('group', { name: '지역' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '부산' }));
        await waitFor(() => expect(fetchRestaurants).toHaveBeenLastCalledWith({ areaCode: '6', numOfRows: 12, pageNo: 1 }));
        expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('모드는 기본/AI 두 개이고 길 찾기·공유·약속 시간은 하단 액션 바에 있다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());
        const modes = screen.getByRole('group', { name: '코스 방식' });
        expect(modes.querySelectorAll('button')).toHaveLength(2);
        expect(screen.getByRole('button', { name: /길 찾기/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '공유' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /약속 시간/ })).toHaveAttribute('href', '/view/SET_TIME_PAGE');
        fireEvent.click(screen.getByRole('button', { name: /길 찾기/ }));
        expect(screen.getByRole('button', { name: '코스로 돌아가기' })).toBeInTheDocument();
    });

    it('연속한 방문지 사이에 구간 이동 한 줄을 보여준다', async () => {
        render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
        await waitFor(() => expect(screen.getByText('가나돈까스')).toBeInTheDocument());
        const legs = screen.getAllByText(/다음까지 .*km · (도보|이동) 약 \d+분/);
        expect(legs).toHaveLength(1); // 방문지 2곳 → 구간 1개
        expect(legLabel(0.8)).toBe('다음까지 0.8km · 도보 약 12분');
        expect(legLabel(4.26)).toBe('다음까지 4.3km · 이동 약 64분');
    });
});

test('AI view never enables optional fallback or sends on view or preference changes', async () => {
    mockedFetch.mockClear();
    render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
    fireEvent.click(screen.getByText('AI 코스'));
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', {name: '코스 만들기'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button', {name: '부산'}));
    expect(mockedFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: '코스 만들기'}));
    expect(screen.getByRole('button', {name: '코스 만들기'})).toBeDisabled();
    expect(screen.getByText(/부산 · 당일치기 AI 코스는 아직 준비 중/)).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '서울'}));
    fireEvent.change(screen.getByRole('combobox', {name: '안내 언어'}), {target: {value: 'en'}});
    fireEvent.click(screen.getByRole('button', {name: '코스 만들기'}));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse((mockedFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({regions: ['서울'], duration: '당일치기', responseLocale: 'en', acknowledgeUnverifiedConditions: true, budget: {min: 30000, max: 2000000}});
});

test('empty AI result can be retried with identical conditions', async () => {
    mockedFetch.mockClear();
    mockedFetch.mockResolvedValueOnce({ok: true, status: 200, json: async () => ({itinerary: []})} as never);
    render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
    fireEvent.click(screen.getByText('AI 코스'));
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: '코스 만들기'}));
    await screen.findByText('조건에 맞는 코스를 찾지 못했어요. 여행 목적을 바꿔 다시 시도해 주세요.');
    fireEvent.click(screen.getByRole('button', {name: '코스 만들기'}));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
});

test('Busan directions preserve the region, the selected stop, and the course on return', async () => {
    mockedFetch.mockClear();
    (fetchRestaurants as jest.Mock).mockImplementation(({areaCode}: {areaCode: string}) => Promise.resolve([
        areaCode === '6'
            ? {contentId: 'busan-1', title: '부산 카페', addr: '부산 중구', mapX: 129.04, mapY: 35.11}
            : {contentId: 'seoul-1', title: '서울 카페', mapX: 127, mapY: 37.5},
    ]));
    render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
    await screen.findByText('서울 카페');
    fireEvent.click(screen.getByRole('button', {name: '부산'}));
    await screen.findByText('부산 카페');
    fireEvent.click(screen.getByRole('button', {name: '부산 카페 길찾기'}));
    expect(screen.getByRole('heading', {name: '부산 길찾기'})).toBeInTheDocument();
    expect(screen.getByLabelText('도착 장소·주소')).toHaveValue('부산 카페');
    expect(screen.queryByText('서울 도로 길 찾기')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '코스로 돌아가기'}));
    expect(screen.getByRole('button', {name: '부산'})).toHaveAttribute('aria-pressed', 'true');
    expect(mockedFetch).not.toHaveBeenCalled();
});

test('switching to supported AI conditions is explicit and never opts the user in', async () => {
    mockedFetch.mockClear();
    render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
    fireEvent.click(screen.getByText('AI 코스'));
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
    fireEvent.click(screen.getByRole('button', {name: '부산'}));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', {name: '코스 만들기'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '서울 당일치기로 바꾸기'}));
    expect(screen.getByRole('button', {name: '서울'})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(mockedFetch).not.toHaveBeenCalled();
});

test('changing only the unsupported duration keeps the existing Seoul basic course', async () => {
    mockedFetch.mockClear();
    (fetchRestaurants as jest.Mock).mockResolvedValue([{contentId: 's1', title: '서울 장소', mapX: 127, mapY: 37.5}]);
    render(<RouteScreen screenId="ROUTE_PLANNER" refId={null} />);
    await screen.findByText('서울 장소');
    fireEvent.click(screen.getByText('AI 코스'));
        fireEvent.change(screen.getByLabelText('방문 날짜'),{target:{value:'2026-10-26'}});
    fireEvent.click(screen.getByRole('button', {name: '1박2일'}));
    expect(screen.getByRole('button', {name: '코스 만들기'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '서울 당일치기로 바꾸기'}));
    fireEvent.click(screen.getByText('기본 코스'));
    expect(screen.getByText('서울 장소')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '당일치기'})).toHaveAttribute('aria-pressed', 'true');
    expect(mockedFetch).not.toHaveBeenCalled();
});
