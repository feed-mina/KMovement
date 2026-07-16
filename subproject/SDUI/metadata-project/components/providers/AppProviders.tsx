'use client';

import { usePathname } from 'next/navigation';
import ReactQueryProvider from './ReactQueryProvider';
import { MetadataProvider } from './MetadataProvider';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { isPublicMarketingPath } from '@/lib/seo/siteConfig';

export default function AppProviders({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (isPublicMarketingPath(pathname)) return <>{children}</>;

    return (
        <ReactQueryProvider>
            <ThemeProvider>
                <AuthProvider>
                    <MetadataProvider>
                        <AppShell>{children}</AppShell>
                    </MetadataProvider>
                </AuthProvider>
            </ThemeProvider>
        </ReactQueryProvider>
    );
}
