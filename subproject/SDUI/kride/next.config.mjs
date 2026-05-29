// next-pwa를 사용하려면: npm install next-pwa
// 미설치 시 PWA 없이 정상 동작
let withPWA;

try {
  // .mjs 환경에서는 require 대신 동적 import를 사용합니다.
  const nextPWA = (await import("next-pwa")).default;
  withPWA = nextPWA({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
  });
} catch {
  withPWA = (config) => config;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase =
      process.env.NEXT_PUBLIC_SDUI_API_BASE || "http://localhost:8080";
    const krideApiBase =
      process.env.NEXT_PUBLIC_KRIDE_API_BASE || "http://localhost:8000";
    return [
      {
        source: "/kride-api/:path*",
        destination: `${krideApiBase}/api/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
  images: {
    domains: [
      "daisyui.com",
      "zrprdknyxkqcwqqarqng.supabase.co",
    ],
  },
};

export default withPWA(nextConfig);