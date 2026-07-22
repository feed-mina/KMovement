import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import RecordTimeComponent from '@/components/fields/RecordTimeComponent';

const mockHandleLinkToSetup = jest.fn();
const mockHandleArrival = jest.fn();
const mockUseRecordTime = jest.fn();

jest.mock('@/hooks/useRecordTime', () => ({
    useRecordTime: () => mockUseRecordTime(),
}));

jest.mock('@/components/fields/ArrivalButton', () => ({
    ArrivalButton: ({onClick}: {onClick: () => void}) => (
        <button type="button" onClick={onClick}>도착 완료</button>
    ),
}));

jest.mock('@/utils/dateFormatter', () => ({
    dateFormatter: () => ({
        formatGoalDate: (value: string) => `날짜 ${value}`,
        formatTimePretty: (value: string) => `시간 ${value}`,
    }),
}));

const setViewport = (isMobile: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: jest.fn().mockImplementation(() => ({
            matches: isMobile,
            media: '(max-width: 767px)',
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
};

const noGoalState = {
    goalTime: null,
    todaysMessage: '',
    goalList: [],
    remainTimeText: '',
    handleLinkToSetup: mockHandleLinkToSetup,
    handleArrival: mockHandleArrival,
};

describe('RecordTimeComponent accordion', () => {
    beforeEach(() => {
        window.localStorage.clear();
        jest.clearAllMocks();
        mockUseRecordTime.mockReturnValue(noGoalState);
        setViewport(false);
    });

    it('starts collapsed on mobile and can expand to the setup action', async () => {
        setViewport(true);
        render(<RecordTimeComponent/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /펼치기/})).toHaveAttribute('aria-expanded', 'false');
        });
        expect(screen.queryByRole('button', {name: '시간 설정하기'})).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /펼치기/}));

        expect(screen.getByRole('button', {name: /접기/})).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('button', {name: '시간 설정하기'}));
        expect(mockHandleLinkToSetup).toHaveBeenCalledTimes(1);
        expect(window.localStorage.getItem('kride:record-time-collapsed:v1')).toBe('expanded');
    });

    it('starts expanded on desktop when no preference was saved', () => {
        render(<RecordTimeComponent/>);

        expect(screen.getByRole('button', {name: /접기/})).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', {name: '시간 설정하기'})).toBeVisible();
    });

    it('restores an explicit expanded preference on mobile', async () => {
        setViewport(true);
        window.localStorage.setItem('kride:record-time-collapsed:v1', 'expanded');

        render(<RecordTimeComponent/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /접기/})).toHaveAttribute('aria-expanded', 'true');
        });
        expect(screen.getByRole('button', {name: '시간 설정하기'})).toBeVisible();
    });

    it('collapses goal details while keeping a useful summary visible', async () => {
        mockUseRecordTime.mockReturnValue({
            ...noGoalState,
            goalTime: '2026-07-22T18:30:00',
            todaysMessage: '한강에서 만나요',
            goalList: ['2026-07-23T09:00:00'],
            remainTimeText: '2시간 남음',
        });

        render(<RecordTimeComponent/>);
        expect(screen.getByText(/목표 시간 날짜 2026-07-22T18:30:00/, {selector: 'strong'})).toBeVisible();
        expect(screen.getByRole('button', {name: '도착 완료'})).toBeVisible();

        fireEvent.click(screen.getByRole('button', {name: /접기/}));

        expect(screen.getByText(/목표 시간 날짜 2026-07-22T18:30:00/, {selector: 'strong'})).toBeVisible();
        expect(screen.queryByRole('button', {name: '도착 완료'})).not.toBeInTheDocument();
        expect(window.localStorage.getItem('kride:record-time-collapsed:v1')).toBe('collapsed');
    });
});
