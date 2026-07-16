import "./styles/index.css";
import type { Metadata, Viewport } from 'next';
import AppProviders from '@/components/providers/AppProviders';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import { isSearchIndexingEnabled, siteConfig } from '@/lib/seo/siteConfig';

const indexingEnabled = isSearchIndexingEnabled();

export const metadata: Metadata = {
    title: {
        default: siteConfig.title,
        template: '%s | KRIDE'
    },
    description: siteConfig.description,
    metadataBase: new URL(siteConfig.url),
    keywords: ["KRIDE", "K-컬처", "성지순례", "여행 동선", "K-POP 여행", "AI 여행 플래너"],
    authors: [{ name: "KRIDE Team" }],
    creator: "KRIDE Team",
    publisher: "KRIDE",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    robots: { index: indexingEnabled, follow: indexingEnabled },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
    openGraph: {
        title: siteConfig.title,
        description: siteConfig.description,
        url: '/',
        images: [{ url: siteConfig.image, width: 512, height: 512, alt: 'KRIDE 아이콘' }],
        type: 'website',
        locale: siteConfig.locale,
        siteName: siteConfig.name,
    },
    twitter: {
        card: "summary_large_image",
        title: siteConfig.title,
        description: siteConfig.description,
        images: [siteConfig.image],
    },
};

export const viewport: Viewport = {
    themeColor: "#E50914",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

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
            <script
                id="google-consent-default"
                dangerouslySetInnerHTML={{
                    __html: `window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});`,
                }}
            />
        </head>
        <body className="antialiased">
            <AnalyticsProvider>
                <AppProviders>{children}</AppProviders>
            </AnalyticsProvider>
        </body>
        </html>
    );
}
