import React from 'react';
import { render } from '@testing-library/react';
import ServiceWorkerUpdater from '@/components/layout/ServiceWorkerUpdater';

type Cb = () => void;

function installMockSW(hasController: boolean) {
    const listeners: Record<string, Cb[]> = {};
    const sw = {
        controller: hasController ? {} : null,
        addEventListener: (t: string, cb: Cb) => { (listeners[t] = listeners[t] || []).push(cb); },
        removeEventListener: jest.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    return {
        fire: (t: string) => (listeners[t] || []).forEach((cb) => cb()),
    };
}

describe('ServiceWorkerUpdater — 배포 후 자동 새로고침 가드', () => {
    let reload: jest.Mock;

    beforeEach(() => {
        reload = jest.fn();
        Object.defineProperty(window.location, 'reload', { configurable: true, value: reload });
    });

    it('기존 컨트롤러가 있으면(업데이트) controllerchange 시 새로고침한다', () => {
        const sw = installMockSW(true);
        render(<ServiceWorkerUpdater />);
        sw.fire('controllerchange');
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('최초 설치(컨트롤러 없음)에는 새로고침하지 않는다', () => {
        const sw = installMockSW(false);
        render(<ServiceWorkerUpdater />);
        sw.fire('controllerchange');
        expect(reload).not.toHaveBeenCalled();
    });

    it('중복 controllerchange에도 한 번만 새로고침한다', () => {
        const sw = installMockSW(true);
        render(<ServiceWorkerUpdater />);
        sw.fire('controllerchange');
        sw.fire('controllerchange');
        expect(reload).toHaveBeenCalledTimes(1);
    });
});
