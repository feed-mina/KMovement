'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics/dataLayer';
import { useAnalyticsConsent } from './AnalyticsProvider';

function screenName(pathname: string) {
    if (pathname === '/') return 'marketing_home';
    if (pathname.startsWith('/travel/')) return `marketing_${pathname.split('/').filter(Boolean).at(-1)}`;
    if (pathname.startsWith('/view/')) return pathname.split('/').filter(Boolean).at(-1)?.toLowerCase() || 'dynamic_view';
    return pathname.split('/').filter(Boolean).join('_') || 'home';
}

export default function RouteChangeTracker() {
    const pathname = usePathname();
    const { consent } = useAnalyticsConsent();
    const lastPath = useRef('');

    useEffect(() => {
        if (consent !== 'granted') return;
        const pagePath = pathname;
        if (lastPath.current === pagePath) return;
        lastPath.current = pagePath;
        trackEvent('page_view', {
            page_path: pagePath,
            page_title: document.title,
            screen_name: screenName(pathname),
        });
    }, [consent, pathname]);

    return null;
}
