import {render, screen, waitFor} from '@testing-library/react';
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

it('mapY를 위도, mapX를 경도로 사용하고 핀 선택과 카드 선택을 연결한다', async () => {
    const panTo = jest.fn(); const removeListener = jest.fn(); const handlers: Array<() => void> = [];
    const markers: any[]=[];
    const LatLng = jest.fn((lat,lng)=>({lat,lng}));
    const kakao={maps:{LatLng,Map:jest.fn(()=>({setBounds:jest.fn(),panTo,relayout:jest.fn()})),LatLngBounds:jest.fn(()=>({extend:jest.fn()})),
        Marker:jest.fn(({position})=>{const marker={setMap:jest.fn(),setZIndex:jest.fn(),setOpacity:jest.fn(),getPosition:()=>position}; markers.push(marker);return marker;}),
        event:{addListener:jest.fn((_m,_e,handler)=>handlers.push(handler)),removeListener}}};
    window.kakao=kakao; load.mockResolvedValue(kakao);
    const onSelect=jest.fn();
    const {rerender,unmount}=render(<TourExploreMap pois={pois} selectedId={null} onSelect={onSelect}/>);
    await waitFor(()=>expect(handlers).toHaveLength(2));
    expect(LatLng).toHaveBeenCalledWith(37.5,127);
    handlers[1](); expect(onSelect).toHaveBeenCalledWith('b');
    rerender(<TourExploreMap pois={pois} selectedId="a" onSelect={onSelect}/>);
    expect(panTo).toHaveBeenCalledWith({lat:37.5,lng:127});
    expect(markers[1].setOpacity).toHaveBeenLastCalledWith(0.55);
    unmount(); expect(removeListener).toHaveBeenCalledTimes(2);
    expect(markers[0].setMap).toHaveBeenCalledWith(null);
    delete window.kakao;
});

it('지도 SDK 실패를 목록 오류와 구분한다', async () => {
    load.mockRejectedValue(new Error('SDK failed'));
    render(<TourExploreMap pois={pois} selectedId={null} onSelect={jest.fn()}/>);
    expect(await screen.findByRole('status')).toHaveTextContent('장소 목록은 계속 볼 수 있어요');
});
