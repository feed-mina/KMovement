import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KakaoShareButton from '@/components/fields/kride/KakaoShareButton';
import { loadKakaoShare } from '@/lib/kakao/loadKakaoShare';

jest.mock('@/lib/kakao/loadKakaoShare', () => ({
    __esModule: true,
    loadKakaoShare: jest.fn(),
}));

const mockedLoad = loadKakaoShare as jest.Mock;

describe('KakaoShareButton', () => {
    const sendDefault = jest.fn();

    beforeEach(() => {
        sendDefault.mockClear();
        mockedLoad.mockReset();
        mockedLoad.mockResolvedValue({ Share: { sendDefault } });
    });

    it('클릭 시 카카오 공유(text objectType + 링크)를 호출한다', async () => {
        render(<KakaoShareButton text="하루 코스 공유" path="/view/ROUTE_PLANNER" />);
        fireEvent.click(screen.getByLabelText('공유'));

        await waitFor(() => expect(sendDefault).toHaveBeenCalled());
        const arg = sendDefault.mock.calls[0][0];
        expect(arg.objectType).toBe('text');
        expect(arg.text).toBe('하루 코스 공유');
        expect(arg.link.webUrl).toBe('https://yerin.duckdns.org/view/ROUTE_PLANNER');
        expect(arg.link.mobileWebUrl).toBe('https://yerin.duckdns.org/view/ROUTE_PLANNER');
    });

    it('SDK 로드 실패 시 링크 복사로 대체한다', async () => {
        mockedLoad.mockRejectedValueOnce(new Error('load fail'));
        const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        render(<KakaoShareButton text="x" path="/view/TOUR_EXPLORE" />);
        fireEvent.click(screen.getByLabelText('공유'));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://yerin.duckdns.org/view/TOUR_EXPLORE'));
        expect(alertSpy).toHaveBeenCalledWith('공유 링크를 복사했어요.');
        expect(sendDefault).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });
});
