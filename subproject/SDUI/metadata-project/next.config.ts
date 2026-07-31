// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
});
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const BACKEND_URL = isProd
    ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://yerin.duckdns.org')
    : 'http://localhost:8080';
const FASTAPI_URL = process.env.FASTAPI_URL || process.env.KRIDE_FASTAPI_URL || process.env.GCP_FASTAPI_URL || (isProd ? '' : 'http://localhost:8000');

if (isProd && !FASTAPI_URL) {
    throw new Error('Set FASTAPI_URL, KRIDE_FASTAPI_URL, or GCP_FASTAPI_URL before building the production frontend.');
}

const connectSrc = [
    "'self'",
    'http://localhost:8080',
    'http://localhost:8000',
    'http://43.201.237.68:8081',
    'https://yerin.duckdns.org',
    BACKEND_URL,
    FASTAPI_URL,
    'https://kauth.kakao.com',
    'https://kapi.kakao.com',
    'https://dapi.kakao.com',
    'https://*.kakao.com',
    'https://*.kakaocdn.net',
    'https://*.daumcdn.net',
    'http://*.daumcdn.net',
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://*.googleapis.com',
    'https://*.gstatic.com',
    'wss://ws-us3.pusher.com',
    'https://*.supabase.co',
    'https://res.cloudinary.com',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://*.google-analytics.com',
    'https://*.clarity.ms',
    'https://c.bing.com',
];

const nextConfig: NextConfig = {
    output: 'standalone',
    async rewrites() {
        return [
            {
                source: '/kride-api/:path*',
                destination: `${FASTAPI_URL}/api/:path*`,
            },
            {
                source: '/api/:path*',
                destination: `${BACKEND_URL}/api/:path*`,
            },
        ];
    },
    async redirects() {
        return [
            // 서울 한정이던 가이드가 시·도별 경로로 옮겨졌다.
            {
                source: '/travel/seoul-food',
                destination: '/travel/food/seoul',
                permanent: true,
            },
            {
                source: '/travel/seoul-kpop',
                destination: '/travel/kpop/seoul',
                permanent: true,
            },
        ];
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://t1.daumcdn.net https://t1.daumcdn.net https://dapi.kakao.com https://*.kakao.com https://*.kakaocdn.net https://*.daumcdn.net http://*.daumcdn.net https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com https://www.googletagmanager.com https://*.clarity.ms https://vercel.live https://*.vercel.app https://va.vercel-scripts.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "img-src 'self' data: blob: https: http://*.daumcdn.net http://*.kakaocdn.net https://*.daumcdn.net https://*.kakao.com https://*.kakaocdn.net https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com https://*.supabase.co https://www.google-analytics.com https://*.clarity.ms https://c.bing.com",
                            `connect-src ${Array.from(new Set(connectSrc)).join(' ')}`,
                            "font-src 'self' data: https://fonts.gstatic.com",
                            "media-src 'self' blob: https://*.supabase.co https://res.cloudinary.com",
                            "frame-src http://postcode.map.daum.net https://postcode.map.daum.net http://postcode.map.kakao.com https://postcode.map.kakao.com https://www.googletagmanager.com",
                            "object-src 'none'",
                            "frame-ancestors 'none'",
                            "worker-src 'self'",
                        ].join('; '),
                    },
                ],
            },
        ];
    },
};

export default withPWA(nextConfig);
