import {
    ANALYTICS_CONSENT_CHANGED_EVENT,
    ANALYTICS_CONSENT_LEGACY_STORAGE_KEY,
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

    afterEach(() => jest.restoreAllMocks());

    it('stores a choice and updates Google and Clarity', () => {
        expect(saveAnalyticsConsent('granted')).toBe(true);
        expect(readAnalyticsConsent()).toBe('granted');
        expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('granted');
        expect(window.gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({analytics_storage: 'granted', ad_storage: 'denied'}));
        expect(window.clarity).toHaveBeenCalledWith('consentv2', {ad_Storage: 'denied', analytics_Storage: 'granted'});
    });

    it.each(['granted', 'denied'] as const)('keeps %s after a fresh read', (choice) => {
        saveAnalyticsConsent(choice);
        expect(readAnalyticsConsent()).toBe(choice);
    });

    it('migrates the unversioned legacy key without asking again', () => {
        window.localStorage.setItem(ANALYTICS_CONSENT_LEGACY_STORAGE_KEY, 'denied');

        expect(readAnalyticsConsent()).toBe('denied');
        expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('denied');
        expect(window.localStorage.getItem(ANALYTICS_CONSENT_LEGACY_STORAGE_KEY)).toBeNull();
    });

    it('treats unknown stored values as unset', () => {
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'yes-please');
        expect(readAnalyticsConsent()).toBe('unset');
    });

    it('handles WebView DOM storage write failures without reopening during the current session', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(saveAnalyticsConsent('denied')).toBe(false);
        expect(readAnalyticsConsent()).toBe('denied');
    });

    it('dispatches one consent change event per explicit choice', () => {
        const listener = jest.fn();
        window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, listener);

        saveAnalyticsConsent('denied');

        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, listener);
    });

    it('clears Clarity consent when permission is revoked', () => {
        applyAnalyticsConsent('denied');
        expect(window.clarity).toHaveBeenCalledWith('consent', false);
    });
});
