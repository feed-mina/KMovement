export type AnalyticsConsent = 'granted' | 'denied' | 'unset';

export const ANALYTICS_CONSENT_STORAGE_KEY = 'kride:analytics-consent';
export const ANALYTICS_CONSENT_CHANGED_EVENT = 'kride:analytics-consent-changed';

declare global {
    interface Window {
        dataLayer?: unknown[];
        clarity?: (...args: unknown[]) => void;
        gtag?: (...args: unknown[]) => void;
    }
}

export function readAnalyticsConsent(): AnalyticsConsent {
    if (typeof window === 'undefined') return 'unset';
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'unset';
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
    else window.dataLayer.push({ event: 'consent_update', ...settings });
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

export function saveAnalyticsConsent(consent: Exclude<AnalyticsConsent, 'unset'>) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
    applyAnalyticsConsent(consent);
    window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_CHANGED_EVENT, { detail: consent }));
}
