'use client';
import { useState } from 'react';
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import RecordTimeComponent from "@/components/fields/RecordTimeComponent";
import ServiceWorkerUpdater from "@/components/layout/ServiceWorkerUpdater";
import {useDeviceType} from "@/hooks/useDeviceType";
import { usePathname } from 'next/navigation';
import FocusFooterBar from "@/components/layout/FocusFooterBar";

const KRIDE_PATHS = ['/INTRO1', '/INTRO2', '/INTRO3', '/INTRO4', '/INTRO5', '/MY_LIST', '/FOCUS', '/CHAT', '/KRIDE_CHAT'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const { isMobile, deviceClass } = useDeviceType();
    const isPc = !isMobile;
    const pathname = usePathname();
    const isAdminToolPath = pathname?.startsWith('/admin');
    const isKrideScreen = KRIDE_PATHS.some(p => pathname?.includes(p));
    const isFocusScreen = pathname?.includes('/FOCUS');

    if (isAdminToolPath) {
        return <>{children}</>;
    }

    return (
        <div className={`app-wrapper ${deviceClass} ${isKrideScreen ? 'kride-fullscreen' : ''}${!isPc && !isKrideScreen ? ' has-bottom-nav' : ''}`}>
            <ServiceWorkerUpdater />

            {!isKrideScreen && (isPc ? (
                <Sidebar
                    collapsed={isSidebarCollapsed}
                    onToggle={() => setIsSidebarCollapsed(current => !current)}
                />
            ) : <Header />)}

            <main className="main-contents-area">
                {isPc && !isKrideScreen && (
                    <div className="pc-top-utility">
                        <RecordTimeComponent />
                    </div>
                )}

                <section className="page-view-container" data-clarity-mask="true">
                    {children}
                </section>
                
                {isFocusScreen && <FocusFooterBar />}
            </main>

            {!isKrideScreen && !isPc && <BottomNav />}
        </div>
    );
}
