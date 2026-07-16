import { trackEvent } from '@/lib/analytics/dataLayer';
import { ANALYTICS_CONSENT_STORAGE_KEY } from '@/lib/analytics/consent';

describe('analytics data layer', () => {
    const originalGtmId = process.env.NEXT_PUBLIC_GTM_ID;

    beforeEach(() => {
        process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
        window.localStorage.clear();
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');
        window.dataLayer = [];
    });

    afterAll(() => {
        process.env.NEXT_PUBLIC_GTM_ID = originalGtmId;
    });

    it('pushes allowlisted primitive values after consent', () => {
        expect(trackEvent('itinerary_generated', { place_count: 3, duration: '당일치기', source: 'test' })).toBe(true);
        expect(window.dataLayer).toContainEqual({ event: 'itinerary_generated', place_count: 3, duration: '당일치기', source: 'test' });
    });

    it('does not push without consent or a configured container', () => {
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'denied');
        expect(trackEvent('itinerary_start', { entry_point: 'test' })).toBe(false);
        process.env.NEXT_PUBLIC_GTM_ID = '';
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');
        expect(trackEvent('itinerary_start', { entry_point: 'test' })).toBe(false);
        expect(window.dataLayer).toEqual([]);
    });

    it('drops personal-data keys at the shared boundary', () => {
        const unsafe = { method: 'email', email: 'person@example.com', phone: '01012345678' } as never;
        trackEvent('login', unsafe);
        expect(window.dataLayer).toContainEqual({ event: 'login', method: 'email' });
    });
});
