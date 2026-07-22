export type AnalyticsConsent = 'granted' | 'denied' | 'unset';

export const ANALYTICS_CONSENT_STORAGE_KEY = 'kride:analytics-consent:v1';
export const ANALYTICS_CONSENT_LEGACY_STORAGE_KEY = 'kride:analytics-consent';
export const ANALYTICS_CONSENT_CHANGED_EVENT = 'kride:analytics-consent-changed';

declare global {
    interface Window {
        dataLayer?: unknown[];
        clarity?: (...args: unknown[]) => void;
        gtag?: (...args: unknown[]) => void;
    }
}

let volatileConsent: Exclude<AnalyticsConsent, 'unset'> | null = null;
let storageWriteFailed = false;

function isSavedConsent(value: unknown): value is Exclude<AnalyticsConsent, 'unset'> {
    return value === 'granted' || value === 'denied';
}

function readStorageKey(key: string): {value: string | null; available: boolean} {
    try {
        return {value: window.localStorage.getItem(key), available: true};
    } catch {
        return {value: null, available: false};
    }
}

export function readAnalyticsConsent(): AnalyticsConsent {
    if (typeof window === 'undefined') return 'unset';

    const current = readStorageKey(ANALYTICS_CONSENT_STORAGE_KEY);
    if (isSavedConsent(current.value)) return current.value;

    const legacy = readStorageKey(ANALYTICS_CONSENT_LEGACY_STORAGE_KEY);
    if (isSavedConsent(legacy.value)) {
        try {
            window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, legacy.value);
            window.localStorage.removeItem(ANALYTICS_CONSENT_LEGACY_STORAGE_KEY);
            storageWriteFailed = false;
        } catch {
            storageWriteFailed = true;
        }
        volatileConsent = legacy.value;
        return legacy.value;
    }

    if (((!current.available && !legacy.available) || storageWriteFailed) && volatileConsent) return volatileConsent;
    return 'unset';
}

function pushGoogleConsent(consent: Exclude<AnalyticsConsent, 'unset'>) {
    window.dataLayer = window.dataLayer || [];
    const settings = {
        analytics_storage: consent,
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
    };
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', settings);
    else window.dataLayer.push({event: 'consent_update', ...settings});
}

export function applyAnalyticsConsent(consent: Exclude<AnalyticsConsent, 'unset'>) {
    if (typeof window === 'undefined') return;
    pushGoogleConsent(consent);
    if (typeof window.clarity === 'function') {
        window.clarity('consentv2', {
            ad_Storage: 'denied',
            analytics_Storage: consent,
        });
        if (consent === 'denied') window.clarity('consent', false);
    }
}

export function saveAnalyticsConsent(consent: Exclude<AnalyticsConsent, 'unset'>): boolean {
    if (typeof window === 'undefined') return false;

    volatileConsent = consent;
    let storageSaved = false;
    try {
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
        window.localStorage.removeItem(ANALYTICS_CONSENT_LEGACY_STORAGE_KEY);
        storageSaved = true;
        storageWriteFailed = false;
    } catch {
        // Some WebViews and privacy-restricted browsers disable DOM storage.
        storageWriteFailed = true;
    }

    applyAnalyticsConsent(consent);
    window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_CHANGED_EVENT, {detail: consent}));
    return storageSaved;
}
