import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import TourExploreMap, {hasTourCoordinates} from '@/components/plugins/travel/TourExploreMap';
import {loadKakaoMaps} from '@/components/fields/kride/maps/loadKakaoMaps';
jest.mock('@/components/fields/kride/maps/loadKakaoMaps', () => ({loadKakaoMaps: jest.fn()}));
const load = loadKakaoMaps as jest.Mock;
const pois = [{contentId:'a',title:'장소 A',mapX:127,mapY:37.5},{contentId:'b',title:'장소 B',mapX:128,mapY:36}];

it('유효한 경도/위도만 허용하며 0,0과 비정상 좌표를 제외한다', () => {
    expect(hasTourCoordinates(pois[0])).toBe(true);
    for (const coords of [{mapX:0,mapY:0},{mapX:NaN,mapY:37},{mapX:181,mapY:37},{mapX:127,mapY:91},{mapX:127}]) {
        expect(hasTourCoordinates({title:'bad',...coords})).toBe(false);
    }
});

it('좌표와 키보드 가능한 핀을 연결하고 선택 강조·이벤트 정리를 유지한다', async () => {
    const panTo = jest.fn(); const setCenter = jest.fn();
    const overlays: any[] = [];
    const LatLng = jest.fn((lat, lng) => ({lat, lng}));
    const kakao = {maps: {
        LatLng, Map: jest.fn(() => ({setBounds: jest.fn(), panTo, setCenter, relayout: jest.fn()})),
        LatLngBounds: jest.fn(() => ({extend: jest.fn()})),
        CustomOverlay: jest.fn(({position, content}) => {
            const overlay = {setMap: jest.fn(), setZIndex: jest.fn(), getPosition: () => position, content};
            overlays.push(overlay); return overlay;
        }),
    }};
    load.mockResolvedValue(kakao);
    const onSelect = jest.fn();
    const {rerender, unmount} = render(<TourExploreMap pois={pois} selectedId={null} onSelect={onSelect}/>);
    await waitFor(() => expect(overlays).toHaveLength(2));
    expect(LatLng).toHaveBeenCalledWith(37.5, 127);
    expect(overlays[1].content.tagName).toBe('BUTTON');
    expect(overlays[1].content).toHaveAccessibleName('장소 B 지도 핀');
    fireEvent.click(overlays[1].content);
    expect(onSelect).toHaveBeenCalledWith('b');
    rerender(<TourExploreMap pois={pois} selectedId="a" onSelect={onSelect}/>);
    expect(setCenter).toHaveBeenCalledWith({lat:37.5, lng:127});
    expect(overlays[0].content).toHaveAttribute('aria-pressed', 'true');
    expect(overlays[1].content).toHaveAttribute('data-dimmed', 'true');
    const detachedPin = overlays[1].content;
    unmount();
    expect(overlays[0].setMap).toHaveBeenCalledWith(null);
    onSelect.mockClear(); fireEvent.click(detachedPin);
    expect(onSelect).not.toHaveBeenCalled();
});

it('지도 SDK 실패를 목록 오류와 구분한다', async () => {
    load.mockReset();
    load.mockRejectedValue(new Error('SDK failed'));
    render(<TourExploreMap pois={pois} selectedId={null} onSelect={jest.fn()}/>);
    expect(await screen.findByRole('status')).toHaveTextContent('장소 목록은 계속 볼 수 있어요');
    expect(screen.getByRole('status')).toHaveAttribute('data-error-source', 'map-sdk');
    fireEvent.click(screen.getByRole('button', {name:'지도 다시 시도'}));
    await waitFor(()=>expect(load).toHaveBeenCalledTimes(2));
});
