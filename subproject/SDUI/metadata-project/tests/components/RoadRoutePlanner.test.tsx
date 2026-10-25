import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RoadRoutePlanner from '@/components/plugins/travel/RoadRoutePlanner';
import { searchDirectionPlaces } from '@/lib/kride/directions';

jest.mock('next/dynamic', () => () => function Map({ points }: { points: unknown[] }) {
    return <div data-testid="road-map">{JSON.stringify(points)}</div>;
});
jest.mock('@/lib/kride/directions', () => ({
    ...jest.requireActual('@/lib/kride/directions'), searchDirectionPlaces: jest.fn(),
}));
const seoul = { id: 's1', name: '서울역', address: '서울 중구 한강대로 405', lat: 37.5547, lon: 126.9707 };
const busan = { id: 'b1', name: '부산역', address: '부산 동구 중앙대로 206', lat: 35.1151, lon: 129.0414 };
const beach = { id: 'b2', name: '해운대해수욕장', address: '부산 해운대구', lat: 35.1587, lon: 129.1604 };
let getPosition: jest.Mock;
beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    getPosition = jest.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
    (searchDirectionPlaces as jest.Mock).mockResolvedValue([seoul]);
});
async function searchOrigin(query = '서울역', place = seoul) {
    fireEvent.change(screen.getByLabelText('출발 장소·주소'), { target: { value: query } });
    fireEvent.submit(screen.getByRole('form', { name: '출발 장소·주소 검색' }));
    const results = await screen.findByRole('list', { name: '출발 장소·주소 검색 결과' });
    fireEvent.click(within(results).getByRole('button', { name: new RegExp(place.name) }));
}

test('starts with location/address choices, without coordinates, permission prompt or route POST', () => {
    render(<RoadRoutePlanner region="부산" />);
    expect(screen.getByRole('heading', { name: '어디에서 출발할까요?' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '부산 길찾기' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByText('서울 도로 길 찾기')).not.toBeInTheDocument();
    expect(getPosition).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
});

test('keeps the Busan destination and uses both selected points in the external route', async () => {
    (searchDirectionPlaces as jest.Mock).mockResolvedValue([busan]);
    render(<RoadRoutePlanner region="부산" initialDestination={beach} destinations={[beach]} />);
    await searchOrigin('부산역', busan);
    const url = decodeURIComponent(screen.getByRole('link', { name: '카카오맵에서 길찾기' }).getAttribute('href')!);
    expect(url).toContain('from/부산역,35.1151,129.0414/to/해운대해수욕장,35.1587,129.1604');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('앱에서 산책 경로 미리보기')).not.toBeInTheDocument();
});

test('gets location only after a choice, then keeps it in memory for the chosen destination', () => {
    render(<RoadRoutePlanner region="부산" initialDestination={beach} />);
    fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
    expect(getPosition).toHaveBeenCalledTimes(1);
    act(() => getPosition.mock.calls[0][0]({ coords: { latitude: 35.12, longitude: 129.04, accuracy: 20 } }));
    expect(screen.getByRole('link', { name: '카카오맵에서 길찾기' })).toHaveAttribute('href', expect.stringContaining('35.12,129.04'));
    expect(fetch).not.toHaveBeenCalled();
});

test('denied location leaves address search usable', async () => {
    render(<RoadRoutePlanner initialDestination={seoul} />);
    fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
    act(() => getPosition.mock.calls[0][1]({ code: 1 }));
    expect(screen.getByRole('alert')).toHaveTextContent('출발 주소를 검색하면 계속');
    await searchOrigin();
    expect(screen.getByRole('link', { name: '카카오맵에서 길찾기' })).toBeInTheDocument();
});

test('a missing geolocation API leaves manual search available', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    render(<RoadRoutePlanner />);
    fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
    expect(screen.getByRole('alert')).toHaveTextContent('출발 주소를 검색');
    expect(screen.getByLabelText('출발 장소·주소')).toBeEnabled();
});

test.each([{ code: 2 }, { code: 3 }])('location failure %p allows retry or address search', reason => {
    render(<RoadRoutePlanner />);
    fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
    act(() => getPosition.mock.calls[0][1](reason));
    expect(screen.getByRole('alert')).toHaveTextContent('현재 위치를 확인하지 못했어요');
    expect(screen.getByRole('button', { name: '현재 위치 사용' })).toBeEnabled();
});

test('inaccurate location is never accepted as an origin', () => {
    render(<RoadRoutePlanner initialDestination={seoul} />);
    fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
    act(() => getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 5000 } }));
    expect(screen.getByRole('alert')).toHaveTextContent('위치 오차');
    expect(screen.queryByRole('link', { name: '카카오맵에서 길찾기' })).not.toBeInTheDocument();
});

test('a late GPS answer cannot overwrite an origin typed in the meantime', () => {
    render(<RoadRoutePlanner initialDestination={beach} />);
    fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
    fireEvent.change(screen.getByLabelText('출발 장소·주소'), { target: { value: '부산역' } });
    act(() => getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } }));
    expect(screen.getByLabelText('출발 장소·주소')).toHaveValue('부산역');
    expect(screen.queryByRole('link', { name: '카카오맵에서 길찾기' })).not.toBeInTheDocument();
});

test('an unavailable search provider offers a text-address fallback instead of coordinates', async () => {
    (searchDirectionPlaces as jest.Mock).mockRejectedValue(new Error('SDK unavailable'));
    render(<RoadRoutePlanner region="부산" />);
    fireEvent.change(screen.getByLabelText('출발 장소·주소'), { target: { value: '부산역' } });
    fireEvent.change(screen.getByLabelText('도착 장소·주소'), { target: { value: '해운대해수욕장' } });
    fireEvent.submit(screen.getByRole('form', { name: '출발 장소·주소 검색' }));
    await screen.findByText(/장소 검색에 연결하지 못했어요/);
    const url = new URL(screen.getByRole('link', { name: 'Google 지도에서 입력한 주소로 계속하기' }).getAttribute('href')!);
    expect(url.searchParams.get('origin')).toBe('부산역');
    expect(url.searchParams.get('destination')).toBe('해운대해수욕장');
});

test('a search miss keeps a helpful retry and no false selected destination', async () => {
    (searchDirectionPlaces as jest.Mock).mockResolvedValue([]);
    render(<RoadRoutePlanner />);
    fireEvent.change(screen.getByLabelText('도착 장소·주소'), { target: { value: '없는장소' } });
    fireEvent.submit(screen.getByRole('form', { name: '도착 장소·주소 검색' }));
    expect(await screen.findByText(/일치하는 장소가 없어요/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '카카오맵에서 길찾기' })).not.toBeInTheDocument();
});

test('editing a selected address clears the old route link', async () => {
    render(<RoadRoutePlanner initialDestination={seoul} />);
    await searchOrigin();
    expect(screen.getByRole('link', { name: '카카오맵에서 길찾기' })).toBeInTheDocument();
    const input = screen.getByLabelText('도착 장소·주소');
    input.focus();
    fireEvent.change(input, { target: { value: '다른 장소' } });
    expect(screen.getByLabelText('도착 장소·주소')).toBe(input);
    expect(input).toHaveFocus();
    expect(screen.queryByRole('link', { name: '카카오맵에서 길찾기' })).not.toBeInTheDocument();
});

test('stale search results cannot replace a newer query', async () => {
    let finish!: (rows: typeof seoul[]) => void;
    (searchDirectionPlaces as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<RoadRoutePlanner />);
    fireEvent.change(screen.getByLabelText('출발 장소·주소'), { target: { value: '서울역' } });
    fireEvent.submit(screen.getByRole('form', { name: '출발 장소·주소 검색' }));
    fireEvent.change(screen.getByLabelText('출발 장소·주소'), { target: { value: '부산역' } });
    await act(async () => finish([seoul]));
    expect(screen.queryByRole('list', { name: '출발 장소·주소 검색 결과' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('출발 장소·주소')).toHaveValue('부산역');
});

test('passes complete ordered geometry only after explicit optional preview', async () => {
    const points = [{ lat: 37.5, lon: 127 }, { lat: 37.51, lon: 127.01 }, { lat: 37.52, lon: 127 }];
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ path: points, total_distance_km: 2 }) });
    render(<RoadRoutePlanner initialDestination={seoul} />);
    await searchOrigin();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('앱에서 산책 경로 미리보기'));
    fireEvent.click(screen.getByRole('button', { name: '두 장소 사이 산책 경로 보기' }));
    await waitFor(() => expect(screen.getByTestId('road-map')).toHaveTextContent(JSON.stringify(points)));
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({ start_lat: seoul.lat, end_lon: seoul.lon });
});

test('preview failure preserves external directions and never shows a successful old map', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 422, json: async () => ({ detail: 'unsupported' }) });
    render(<RoadRoutePlanner initialDestination={seoul} />);
    await searchOrigin();
    fireEvent.click(screen.getByText('앱에서 산책 경로 미리보기'));
    fireEvent.click(screen.getByRole('button', { name: '두 장소 사이 산책 경로 보기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('범위 밖');
    expect(screen.getByRole('link', { name: '카카오맵에서 길찾기' })).toBeInTheDocument();
    expect(screen.queryByTestId('road-map')).not.toBeInTheDocument();
});

test('late place search cannot display stale results after choosing current location', async () => {
    let finish!: (rows: typeof seoul[]) => void;
    (searchDirectionPlaces as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<RoadRoutePlanner initialDestination={beach} />);
    fireEvent.change(screen.getByLabelText('출발 장소·주소'), { target: { value: '서울역' } });
    fireEvent.submit(screen.getByRole('form', { name: '출발 장소·주소 검색' }));
    fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
    act(() => getPosition.mock.calls[0][0]({ coords: { latitude: 35.12, longitude: 129.04, accuracy: 20 } }));
    await act(async () => finish([seoul]));
    expect(screen.queryByRole('list', { name: '출발 장소·주소 검색 결과' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('출발 장소·주소')).toHaveValue('현재 위치');
});
