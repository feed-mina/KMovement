import { render, screen, waitFor } from '@testing-library/react';
import KakaoRouteMap from '@/components/fields/kride/maps/KakaoRouteMap';
import { loadKakaoMaps } from '@/components/fields/kride/maps/loadKakaoMaps';

jest.mock('@/components/fields/kride/maps/loadKakaoMaps', () => ({
  loadKakaoMaps: jest.fn(),
}));

jest.mock('@/components/fields/kride/maps/LeafletFallbackMap', () => ({
  __esModule: true,
  default: () => <div data-testid="leaflet-fallback">Fallback map</div>,
}));

const mockedLoadKakaoMaps = loadKakaoMaps as jest.MockedFunction<typeof loadKakaoMaps>;

describe('KakaoRouteMap', () => {
  beforeEach(() => {
    mockedLoadKakaoMaps.mockReset();
  });

  it('renders the fallback map when the Kakao SDK cannot load', async () => {
    mockedLoadKakaoMaps.mockRejectedValue(new Error('Kakao SDK rejected the app key.'));

    render(
      <KakaoRouteMap
        appKey="test-key"
        data={{
          center: [37.5665, 126.978],
          zoom: 13,
          markers: [],
        }}
        onMarkerSelect={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('leaflet-fallback')).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Kakao Maps is unavailable. Showing the fallback map.'
    );
  });
});
