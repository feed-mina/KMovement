import "./styles/index.css";
import type { Metadata, Viewport } from 'next';
import ReactQueryProvider from "@/components/providers/ReactQueryProvider"; // 방금 만든 방 가져오기
import {MetadataProvider} from "@/components/providers/MetadataProvider";
import { AuthProvider } from '@/context/AuthContext';
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: {
        default: 'SDUI',
        template: '%s | SDUI'
    },
    description: '스마트한 일정 관리 앱',
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yerin.duckdns.org'),
    keywords: ["SDUI", "일정 관리", "스마트 캘린더", "할일 관리", "투두 리스트"],
    authors: [{ name: "SDUI Team" }],
    creator: "SDUI Team",
    publisher: "SDUI",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    alternates: {
        canonical: "/",
    },
    openGraph: {
        title: 'SDUI',
        description: '스마트한 일정 관리 앱',
        images: [{ url: '/icons/icon-512x512.png', width: 512, height: 512, alt: 'SDUI 아이콘' }],
        type: 'website',
        locale: 'ko_KR',
        siteName: 'SDUI'
    },
    twitter: {
        card: "summary_large_image",
        title: 'SDUI',
        description: '스마트한 일정 관리 앱',
        images: ['/icons/icon-512x512.png'],
    },
};

export const viewport: Viewport = {
    themeColor: "#4F46E5",
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
            {/* screenId는 일단 전달하되, 나중에 URL 파라미터나 경로 기반으로 동적 처리할 것 */}
            <AuthProvider>
            <MetadataProvider>
                {/* 레이아웃크기에 따라 바뀌는 AppShell는 데이터 흐름 안쪽, 하지만 UI 구조에 방해 안 되는 곳에 위치 */}
                <AppShell>
                    {children}
                </AppShell>
            </MetadataProvider>
            </AuthProvider>
        </ReactQueryProvider>
        </body>
        </html>
    );
}
