'use client';
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import RecordTimeComponent from "@/components/fields/RecordTimeComponent";
import {useDeviceType} from "@/hooks/useDeviceType";
import { usePathname } from 'next/navigation';

const KRIDE_PATHS = ['/INTRO1', '/INTRO2', '/INTRO3', '/INTRO4', '/INTRO5', '/MY_LIST', '/FOCUS', '/CHAT', '/KRIDE_CHAT'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { isMobile, deviceClass } = useDeviceType();
    const isPc = !isMobile;
    const pathname = usePathname();
    const isKrideScreen = KRIDE_PATHS.some(p => pathname?.includes(p));

    return (
        <div className={`app-wrapper ${deviceClass} ${isKrideScreen ? 'kride-fullscreen' : ''}`}>

            {!isKrideScreen && (isPc ? <Sidebar /> : <Header />)}

            <main className="main-contents-area">
                {isPc && !isKrideScreen && (
                    <div className="pc-top-utility">
                        <RecordTimeComponent />
                    </div>
                )}

                <section className="page-view-container">
                    {children}
                </section>
            </main>
        </div>
    );
}