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
const FASTAPI_URL = process.env.FASTAPI_URL || (isProd ? process.env.GCP_FASTAPI_URL || 'http://yerin.duckdns.org:8000' : 'http://localhost:8000');

const connectSrc = [
    "'self'",
    'http://localhost:8080',
    'http://localhost:8000',
    'http://43.201.237.68:8081',
    'https://yerin.duckdns.org',
    'http://yerin.duckdns.org:8000',
    BACKEND_URL,
    FASTAPI_URL,
    'https://kauth.kakao.com',
    'https://kapi.kakao.com',
    'https://dapi.kakao.com',
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://*.googleapis.com',
    'https://*.gstatic.com',
    'https://vercel.live',
    'https://*.vercel.app',
    'wss://ws-us3.pusher.com',
];

const nextConfig: NextConfig = {
    output: 'standalone',
    async redirects() {
        return [
            {
                source: '/',
                destination: '/view/MAIN_PAGE',
                permanent: false,
            },
        ];
    },
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
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://t1.daumcdn.net https://t1.daumcdn.net https://dapi.kakao.com https://t1.kakaocdn.net https://k.kakaocdn.net https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com https://vercel.live https://*.vercel.app https://va.vercel-scripts.com",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: blob: https: http://k.kakaocdn.net https://*.daumcdn.net https://*.kakao.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com",
                            `connect-src ${Array.from(new Set(connectSrc)).join(' ')}`,
                            "font-src 'self' data:",
                            "media-src 'self' blob:",
                            "frame-src http://postcode.map.daum.net https://postcode.map.daum.net http://postcode.map.kakao.com https://postcode.map.kakao.com",
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
