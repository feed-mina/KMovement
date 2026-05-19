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
    ? 'https://yerin.duckdns.org' // 실제 AWS 백엔드 도메인 입력 (lab 환경)
    : 'http://localhost:8080';

const nextConfig: NextConfig = {
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
                destination: 'http://localhost:8000/api/:path*',
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
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://t1.daumcdn.net https://t1.daumcdn.net https://t1.kakaocdn.net https://k.kakaocdn.net https://vercel.live https://*.vercel.app https://va.vercel-scripts.com",  // Next.js + Daum/Kakao API + Vercel Live + Vercel Analytics
                            "style-src 'self' 'unsafe-inline'",                  // Tailwind 인라인 스타일 허용
                            "img-src 'self' data: data: blob: https: http://k.kakaocdn.net",                 // 외부 이미지 허용
                            "connect-src 'self' http://localhost:8080 http://localhost:8000 http://43.201.237.68:8081 https://yerin.duckdns.org https://kauth.kakao.com https://kapi.kakao.com https://vercel.live https://*.vercel.app wss://ws-us3.pusher.com", // API 서버 + Vercel Live
                            "font-src 'self' data:",
                            "media-src 'self' blob:;",
                            "frame-src http://postcode.map.daum.net https://postcode.map.daum.net http://postcode.map.kakao.com https://postcode.map.kakao.com",  // Daum/Kakao 우편번호 iframe (도메인 변경 2026-03-10)
                            "object-src 'none'",
                            "frame-ancestors 'none'",
                            "worker-src 'self'",  // PWA 서비스 워커
                        ].join('; '),
                    },
                ],
            },
        ];
    },
};

export default withPWA(nextConfig);