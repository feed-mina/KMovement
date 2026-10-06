'use client';
import { useState } from 'react';
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import RecordTimeComponent from "@/components/fields/RecordTimeComponent";
import ServiceWorkerUpdater from "@/components/layout/ServiceWorkerUpdater";
import {useDeviceType} from "@/hooks/useDeviceType";
import { usePathname } from 'next/navigation';
import KrideNav from './KrideNav';
import Link from 'next/link';
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

    const step = pathname?.match(/\/INTRO([1-5])$/)?.[1];
    if (!pathname?.startsWith('/view/admin')) return <div className="kride-site-shell"><ServiceWorkerUpdater/><KrideNav/>{step&&<nav className="course-progress" aria-label="코스 작성 단계"><Link href="/view/kpop">탐색으로 나가기</Link><span>코스 만들기 · {step}/5단계</span>{Number(step)>1&&<Link href={'/view/INTRO'+(Number(step)-1)}>이전 단계</Link>}</nav>}<main className="kride-site-content">{pathname?.endsWith('/ROUTE_PLANNER')&&<RecordTimeComponent/>}{children}</main>{isFocusScreen&&<FocusFooterBar/>}</div>;
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
