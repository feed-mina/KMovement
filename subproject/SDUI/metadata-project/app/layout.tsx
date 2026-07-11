import "./styles/index.css";
import type { Metadata, Viewport } from 'next';
import ReactQueryProvider from "@/components/providers/ReactQueryProvider"; // 방금 만든 방 가져오기
import {MetadataProvider} from "@/components/providers/MetadataProvider";
import {ThemeProvider} from "@/components/providers/ThemeProvider";
import { AuthProvider } from '@/context/AuthContext';
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: {
        default: 'KRIDE',
        template: '%s | KRIDE'
    },
    description: 'AI가 짜주는 K-컬처 여행 동선',
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yerin.duckdns.org'),
    keywords: ["KRIDE", "K-컬처", "성지순례", "여행 동선", "K-POP 여행", "AI 여행 플래너"],
    authors: [{ name: "KRIDE Team" }],
    creator: "KRIDE Team",
    publisher: "KRIDE",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    alternates: {
        canonical: "/",
    },
    openGraph: {
        title: 'KRIDE',
        description: 'AI가 짜주는 K-컬처 여행 동선',
        images: [{ url: '/icons/icon-512x512.png', width: 512, height: 512, alt: 'KRIDE 아이콘' }],
        type: 'website',
        locale: 'ko_KR',
        siteName: 'KRIDE'
    },
    twitter: {
        card: "summary_large_image",
        title: 'KRIDE',
        description: 'AI가 짜주는 K-컬처 여행 동선',
        images: ['/icons/icon-512x512.png'],
    },
};

export const viewport: Viewport = {
    themeColor: "#E50914",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

//  @@@@ 2026-02-08 수정 MetadataProvider 적용
// layout.tsx 에 있는 컴포넌트들이 undefined 에러 없이 데이터를 안정적으로 받아오게 하는 API 흐름 설계
// @@@@ layout 역할 :  프론트앤드 전체 레이아웃 구조
export default function RootLayout({children}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
        <head>
            <link rel="manifest" href="/manifest.json" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        </head>
        <body className="antialiased">
        {/* 가장 바깥에서 QueryClient를 공급한다  */}
        <ReactQueryProvider>
            {/* DB design_tokens를 :root CSS 변수로 주입 (실패 시 tokens.css 폴백) */}
            <ThemeProvider>
            {/* screenId는 일단 전달하되, 나중에 URL 파라미터나 경로 기반으로 동적 처리할 것 */}
            <AuthProvider>
            <MetadataProvider>
                {/* 레이아웃크기에 따라 바뀌는 AppShell는 데이터 흐름 안쪽, 하지만 UI 구조에 방해 안 되는 곳에 위치 */}
                <AppShell>
                    {children}
                </AppShell>
            </MetadataProvider>
            </AuthProvider>
            </ThemeProvider>
        </ReactQueryProvider>
        </body>
        </html>
    );
}
