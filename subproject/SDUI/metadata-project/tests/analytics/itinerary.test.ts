import { countItineraryPlaces } from '@/lib/analytics/itinerary';

describe('countItineraryPlaces', () => {
    it('counts direct and time-slot itinerary places', () => {
        expect(countItineraryPlaces({ itinerary: [{ morning: { places: [{}, {}] }, afternoon: { places: [{}] } }] })).toBe(3);
        expect(countItineraryPlaces({ itinerary: { days: [{ places: [{}, {}] }] } })).toBe(2);
    });

    it('uses resolved markers and rejects an empty result', () => {
        expect(countItineraryPlaces({ mapData: { markers: [{}, {}, {}] } })).toBe(3);
        expect(countItineraryPlaces({ itinerary: [{ day: 1 }] })).toBe(0);
        expect(countItineraryPlaces(null)).toBe(0);
    });
});
