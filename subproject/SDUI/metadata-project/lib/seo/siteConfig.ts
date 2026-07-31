import { foodAreaPath, foodAreaSlugs, kpopAreaPath, kpopAreaSlugs } from './travelContent';

const FALLBACK_SITE_URL = 'https://yerin.duckdns.org';

function normalizeSiteUrl(value?: string) {
    try {
        const url = new URL(value || FALLBACK_SITE_URL);
        url.pathname = '/';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch {
        return FALLBACK_SITE_URL;
    }
}

export const siteConfig = {
    name: 'KRIDE',
    title: 'KRIDE | AI K-컬처 여행 플래너',
    description: 'K-POP 성지와 전국 맛집을 찾고, 취향에 맞는 여행 동선을 만드는 AI K-컬처 여행 서비스입니다.',
    url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
    locale: 'ko_KR',
    image: '/icons/icon-512x512.png',
} as const;

export function isSearchIndexingEnabled() {
    if (process.env.NEXT_PUBLIC_SITE_ENV) {
        return process.env.NEXT_PUBLIC_SITE_ENV === 'production';
    }
    if (process.env.VERCEL_ENV) {
        return process.env.VERCEL_ENV === 'production';
    }
    return process.env.NODE_ENV === 'production';
}

export const publicMarketingPaths = [
    '/',
    '/travel/kpop',
    ...kpopAreaSlugs.map(kpopAreaPath),
    '/travel/food',
    ...foodAreaSlugs.map(foodAreaPath),
];

export function isPublicMarketingPath(pathname?: string | null) {
    if (!pathname) return false;
    return pathname === '/' || pathname.startsWith('/travel/');
}
