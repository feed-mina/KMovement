import { normalizeRouteMapData } from '@/components/fields/kride/maps/normalizeRouteMapData';

describe('normalizeRouteMapData', () => {
  it('normalizes lng/lon variants and derives center from markers', () => {
    const data = normalizeRouteMapData({
      markers: [
        { name: '광화문', lat: '37.571', lon: '126.976' },
        { label: '경복궁', latitude: 37.5796, longitude: 126.977 },
      ],
    });

    expect(data.markers).toHaveLength(2);
    expect(data.markers[0]).toMatchObject({
      index: 0,
      name: '광화문',
      lat: 37.571,
      lng: 126.976,
    });
    expect(data.markers[1].name).toBe('경복궁');
    expect(data.center[0]).toBeCloseTo(37.5753, 3);
    expect(data.center[1]).toBeCloseTo(126.9765, 3);
  });

  it('enriches markers with itinerary day and slot metadata', () => {
    const data = normalizeRouteMapData({
      mapData: {
        markers: [
          { name: '성수동', lat: 37.544, lng: 127.055 },
        ],
      },
      itinerary: [
        {
          morning: {
            places: [
              { name: '성수동', description: '카페 거리' },
            ],
          },
          afternoon: { places: [] },
        },
      ],
    });

    expect(data.markers[0]).toMatchObject({
      day: 1,
      slot: 'morning',
      description: '카페 거리',
    });
  });
});
