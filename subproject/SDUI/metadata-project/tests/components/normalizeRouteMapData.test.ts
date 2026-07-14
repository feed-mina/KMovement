import { normalizeRouteMapData, preferNonEmptyMarkers } from '@/components/fields/kride/maps/normalizeRouteMapData';

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

  it('creates markers from coordinates embedded in itinerary days', () => {
    const data = normalizeRouteMapData({
      itinerary: {
        days: [{
          day: 1,
          morning: { places: [{ name: '북촌', mapy: '37.5826', mapx: '126.9830' }] },
          afternoon: { places: [] },
        }],
      },
    });

    expect(data.markers).toHaveLength(1);
    expect(data.markers[0]).toMatchObject({ name: '북촌', day: 1, slot: 'morning' });
    expect(data.hasItinerary).toBe(true);
    expect(data.markerResolutionStatus).toBe('complete');
  });

  it('reports partial resolution without discarding valid markers', () => {
    const data = normalizeRouteMapData({
      itinerary: [{
        morning: { places: [{ name: '성수동' }, { name: '좌표 없는 장소' }] },
        afternoon: { places: [] },
      }],
      markers: [{ name: '성수동', lat: 37.544, lng: 127.055 }],
    });

    expect(data.markers).toHaveLength(1);
    expect(data.unresolvedPlaceCount).toBe(1);
    expect(data.markerResolutionStatus).toBe('partial');
  });

  it('keeps existing markers when an update contains an empty marker array', () => {
    const existing = [{ name: '경복궁', lat: 37.58, lng: 126.97 }];
    expect(preferNonEmptyMarkers([], existing)).toBe(existing);
    expect(preferNonEmptyMarkers([{ name: '광장시장' }], existing)).toEqual([{ name: '광장시장' }]);
  });
});
