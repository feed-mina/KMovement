import { useState, useEffect } from 'react';

export const useDeviceType = () => {
    const [isMobile, setIsMobile] = useState(true); // 모바일 우선(SSR hydration 플래시 방지)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024); // CSS @media(min-width:1024px)와 일치시킴
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return { isMobile, deviceClass: isMobile ? 'is-mobile' : 'is-pc' };
};