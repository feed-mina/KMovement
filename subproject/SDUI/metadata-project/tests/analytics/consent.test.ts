import {
    ANALYTICS_CONSENT_STORAGE_KEY,
    applyAnalyticsConsent,
    readAnalyticsConsent,
    saveAnalyticsConsent,
} from '@/lib/analytics/consent';

describe('analytics consent', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.dataLayer = [];
        window.gtag = jest.fn();
        window.clarity = jest.fn();
    });

    it('stores a choice and updates Google and Clarity', () => {
        saveAnalyticsConsent('granted');
        expect(readAnalyticsConsent()).toBe('granted');
        expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('granted');
        expect(window.gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied' }));
        expect(window.clarity).toHaveBeenCalledWith('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
    });

    it('clears Clarity consent when permission is revoked', () => {
        applyAnalyticsConsent('denied');
        expect(window.clarity).toHaveBeenCalledWith('consent', false);
    });
});
