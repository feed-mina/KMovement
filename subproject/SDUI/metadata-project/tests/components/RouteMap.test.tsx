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

  it('shows unresolved count while keeping resolved markers visible', () => {
    render(<RouteMap data={{
      ...base,
      hasItinerary: true,
      markerResolutionStatus: 'partial',
      unresolvedPlaceCount: 2,
      markers: [{ id: 'p1', index: 0, name: '경복궁', lat: 37.58, lng: 126.97 }],
    }} />);

    expect(screen.getByText('2개 장소의 위치를 확인하지 못했습니다.')).toBeTruthy();
  });
});
