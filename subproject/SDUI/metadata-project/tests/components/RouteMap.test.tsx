import { render, screen } from '@testing-library/react';
import RouteMap from '@/components/fields/kride/maps/RouteMap';

jest.mock('@/components/fields/kride/maps/KakaoRouteMap', () => () => <div data-testid="kakao-map" />);
jest.mock('@/components/fields/kride/maps/GoogleRouteMap', () => () => <div data-testid="google-map" />);
jest.mock('@/components/fields/kride/maps/LeafletFallbackMap', () => () => <div data-testid="fallback-map" />);

describe('RouteMap empty and partial states', () => {
  const base = { center: [37.5665, 126.978] as [number, number], zoom: 13 };

  beforeEach(() => window.localStorage.clear());

  it('distinguishes a generated itinerary whose locations could not be resolved', () => {
    render(<RouteMap data={{ ...base, markers: [], hasItinerary: true, markerResolutionStatus: 'failed' }} />);

    expect(screen.getByText('일정은 생성되었지만 장소 위치를 확인하지 못했습니다.')).toBeTruthy();
    expect(screen.queryByText('표시할 장소가 없습니다.')).toBeNull();
  });

  it('찾은 장소가 하나라도 있으면 지도를 가리지 않는다', () => {
    // 위치를 못 찾은 장소는 지도 위 배너가 아니라 일정 목록의 해당 장소 옆에 표시한다.
    // 배너는 지도를 가리면서도 어느 장소가 문제인지는 알려주지 못했다.
    render(<RouteMap data={{
      ...base,
      hasItinerary: true,
      markerResolutionStatus: 'partial',
      unresolvedPlaceCount: 2,
      markers: [{ id: 'p1', index: 0, name: '경복궁', lat: 37.58, lng: 126.97 }],
    }} />);

    expect(screen.queryByText(/장소의 위치를 확인하지 못했습니다/)).toBeNull();
  });

  it('한 곳도 찾지 못했을 때는 안내를 유지한다', () => {
    render(<RouteMap data={{
      ...base,
      hasItinerary: true,
      markerResolutionStatus: 'failed',
      unresolvedPlaceCount: 3,
      markers: [],
    }} />);

    expect(screen.getByText('일정은 생성되었지만 장소 위치를 확인하지 못했습니다.')).toBeTruthy();
  });
});
