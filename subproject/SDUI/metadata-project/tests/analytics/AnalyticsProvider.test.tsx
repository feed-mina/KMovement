import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {renderToString} from 'react-dom/server';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import {ANALYTICS_CONSENT_STORAGE_KEY} from '@/lib/analytics/consent';

jest.mock('next/script', () => ({
    __esModule: true,
    default: ({id}: {id: string}) => <div data-testid={id}/>,
}));

jest.mock('@/components/analytics/RouteChangeTracker', () => () => null);

const renderProvider = () => render(
    <AnalyticsProvider>
        <div>content</div>
    </AnalyticsProvider>,
);

const originalGtmId = process.env.NEXT_PUBLIC_GTM_ID;
const originalClarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

describe('AnalyticsProvider persistence', () => {
    beforeEach(() => {
        window.localStorage.clear();
        process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
        process.env.NEXT_PUBLIC_CLARITY_ID = 'claritytest';
    });

    afterAll(() => {
        process.env.NEXT_PUBLIC_GTM_ID = originalGtmId;
        process.env.NEXT_PUBLIC_CLARITY_ID = originalClarityId;
    });

    it.each([
        ['거부', 'denied'],
        ['통계 수집 동의', 'granted'],
    ] as const)('%s 선택 후 provider를 재마운트해도 배너를 다시 표시하지 않는다', async (buttonName, storedValue) => {
        const first = renderProvider();
        fireEvent.click(await screen.findByRole('button', {name: buttonName}));

        await waitFor(() => expect(screen.queryByRole('region', {name: '통계 쿠키 설정'})).not.toBeInTheDocument());
        expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(storedValue);
        first.unmount();

        renderProvider();
        await screen.findByRole('button', {name: '개인정보 설정'});
        expect(screen.queryByRole('region', {name: '통계 쿠키 설정'})).not.toBeInTheDocument();
    });

    it('명시적으로 개인정보 설정을 연 경우에만 배너를 다시 표시하고 닫기는 값을 바꾸지 않는다', async () => {
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'denied');
        renderProvider();

        fireEvent.click(await screen.findByRole('button', {name: '개인정보 설정'}));
        expect(await screen.findByRole('region', {name: '통계 쿠키 설정'})).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: '닫기'}));

        await waitFor(() => expect(screen.queryByRole('region', {name: '통계 쿠키 설정'})).not.toBeInTheDocument());
        expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('denied');
    });

    it('hydration 준비 전 서버 HTML에는 배너나 설정 버튼을 넣지 않는다', () => {
        const html = renderToString(
            <AnalyticsProvider>
                <div>content</div>
            </AnalyticsProvider>,
        );

        expect(html).not.toContain('서비스 개선을 위한 통계 수집');
        expect(html).not.toContain('개인정보 설정');
    });

    it('거부 상태에서는 분석 스크립트를 마운트하지 않고 동의 상태에서만 마운트한다', async () => {
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'denied');
        const denied = renderProvider();
        await screen.findByRole('button', {name: '개인정보 설정'});
        expect(screen.queryByTestId('google-tag-manager')).not.toBeInTheDocument();
        expect(screen.queryByTestId('microsoft-clarity')).not.toBeInTheDocument();
        denied.unmount();

        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');
        renderProvider();
        expect(await screen.findByTestId('google-tag-manager')).toBeInTheDocument();
        expect(screen.getByTestId('microsoft-clarity')).toBeInTheDocument();
    });
});
