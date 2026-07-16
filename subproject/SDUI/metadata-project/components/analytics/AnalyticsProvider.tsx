'use client';

import Script from 'next/script';
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
    ANALYTICS_CONSENT_CHANGED_EVENT,
    applyAnalyticsConsent,
    readAnalyticsConsent,
    saveAnalyticsConsent,
    type AnalyticsConsent,
} from '@/lib/analytics/consent';
import RouteChangeTracker from './RouteChangeTracker';
import ConsentBanner from '@/components/privacy/ConsentBanner';
import PrivacySettingsButton from '@/components/privacy/PrivacySettingsButton';

interface ConsentContextValue {
    consent: AnalyticsConsent;
    setConsent: (value: Exclude<AnalyticsConsent, 'unset'>) => void;
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function subscribeToConsent(callback: () => void) {
    const onChange = () => callback();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

export function useAnalyticsConsent() {
    const context = useContext(ConsentContext);
    if (!context) throw new Error('useAnalyticsConsent must be used within AnalyticsProvider');
    return context;
}

function safePublicId(value: string | undefined, pattern: RegExp) {
    return value && pattern.test(value) ? value : '';
}

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const consent = useSyncExternalStore<AnalyticsConsent>(subscribeToConsent, readAnalyticsConsent, () => 'unset');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const gtmId = safePublicId(process.env.NEXT_PUBLIC_GTM_ID, /^GTM-[A-Z0-9]+$/i);
    const gaMeasurementId = safePublicId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, /^G-[A-Z0-9]+$/i);
    const clarityId = safePublicId(process.env.NEXT_PUBLIC_CLARITY_ID, /^[a-z0-9]+$/i);

    useEffect(() => {
        if (consent !== 'unset') applyAnalyticsConsent(consent);
    }, [consent]);

    const setConsent = useCallback((value: 'granted' | 'denied') => {
        saveAnalyticsConsent(value);
        setSettingsOpen(false);
    }, []);

    const context = useMemo(() => ({ consent, setConsent, settingsOpen, setSettingsOpen }), [consent, setConsent, settingsOpen]);
    const enabled = consent === 'granted';

    return (
        <ConsentContext.Provider value={context}>
            {children}
            <Suspense fallback={null}>
                <RouteChangeTracker />
            </Suspense>
            <ConsentBanner />
            <PrivacySettingsButton />
            {enabled && gtmId && (
                <Script id="google-tag-manager" strategy="afterInteractive">
                    {`(function(w,d,s,l,i,g){w[l]=w[l]||[];if(g){w[l].push({ga_measurement_id:g});}w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}','${gaMeasurementId}');`}
                </Script>
            )}
            {enabled && clarityId && (
                <Script id="microsoft-clarity" strategy="afterInteractive">
                    {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);c[a]('consentv2',{ad_Storage:'denied',analytics_Storage:'granted'});})(window,document,'clarity','script','${clarityId}');`}
                </Script>
            )}
        </ConsentContext.Provider>
    );
}
