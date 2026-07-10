'use client';

import { useEffect } from 'react';

/**
 * 배포 후 새 서비스워커(next-pwa, skipWaiting)가 활성화되면 현재 탭을 1회 자동 새로고침한다.
 * 구버전 번들이 캐시로 남아 UI가 중복/깨져 보이던 "배포본 구버전" 문제를 방지한다.
 *
 * controllerchange는 최초 방문(컨트롤러 없음→설치)에도 발생하므로,
 * 마운트 시 이미 컨트롤러가 있던 경우(=업데이트)에만 새로고침한다.
 */
export default function ServiceWorkerUpdater() {
    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

        const hadController = Boolean(navigator.serviceWorker.controller);
        let reloaded = false;

        const onControllerChange = () => {
            if (reloaded || !hadController) return; // 최초 설치 시에는 새로고침하지 않음
            reloaded = true;
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    }, []);

    return null;
}
