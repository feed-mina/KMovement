import { render, screen, waitFor } from '@testing-library/react';
import GoogleRouteMap from '@/components/fields/kride/maps/GoogleRouteMap';
import { loadGoogleMaps } from '@/components/fields/kride/maps/loadGoogleMaps';

jest.mock('@/components/fields/kride/maps/loadGoogleMaps', () => ({
  loadGoogleMaps: jest.fn(),
}));

jest.mock('@/components/fields/kride/maps/LeafletFallbackMap', () => ({
  __esModule: true,
  default: () => <div data-testid="leaflet-fallback">Fallback map</div>,
}));

const mockedLoadGoogleMaps = loadGoogleMaps as jest.MockedFunction<typeof loadGoogleMaps>;

describe('GoogleRouteMap', () => {
  beforeEach(() => {
    mockedLoadGoogleMaps.mockReset();
  });

  it('renders the fallback map when the Google SDK cannot load', async () => {
    mockedLoadGoogleMaps.mockRejectedValue(new Error('Google Maps API rejected this key or project.'));

    render(
      <GoogleRouteMap
        apiKey="test-key"
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
      'Google Maps is unavailable. Showing the fallback map.'
    );
  });
});
