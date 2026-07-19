import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import KrideFocusScreen from '@/components/plugins/travel/KrideFocusScreen';

const mockSetFormData = jest.fn();
const mockHandleAction = jest.fn();

jest.mock('@/components/screens/useScreenGuard', () => ({
    useScreenGuard: () => ({ isLoading: false, blocked: false }),
}));

jest.mock('@/components/screens/useSduiScreen', () => ({
    useSduiScreen: () => ({
        metadata: [],
        pageData: {},
        formData: {},
        setFormData: mockSetFormData,
        handleChange: jest.fn(),
        handleAction: mockHandleAction,
        pwType: 'password',
        showPassword: false,
        activeModal: null,
        closeModal: jest.fn(),
    }),
}));

jest.mock('@/components/DynamicEngine/hook/useKrideItinerary', () => ({
    useKrideItinerary: () => ({ data: null, isLoading: false, error: null }),
}));

jest.mock('@/components/screens/SduiRenderer', () => ({
    __esModule: true,
    default: ({ onAction }: { onAction: (meta: { actionUrl: string }) => void }) => (
        <button type="button" onClick={() => onAction({ actionUrl: '/view/KRIDE_CHAT' })}>
            여행봇 열기
        </button>
    ),
}));

jest.mock('@/components/fields/kride/chat/KrideChatComponent', () => ({
    __esModule: true,
    default: ({ onCloseModal }: { onCloseModal: () => void }) => (
        <>
            <button type="button" aria-label="채팅 닫기" onClick={onCloseModal}>닫기</button>
            <input aria-label="여행 질문" />
        </>
    ),
}));

describe('KrideFocusScreen chat dialog accessibility', () => {
    beforeEach(() => {
        mockSetFormData.mockClear();
        mockHandleAction.mockClear();
    });

    it('exposes an accessible modal and closes it with Escape', () => {
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);

        expect(screen.getByRole('dialog', { name: 'K-RIDE 여행봇' })).toHaveAttribute('aria-modal', 'true');
        expect(screen.getByRole('button', { name: '채팅 닫기' })).toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'K-RIDE 여행봇' })).not.toBeInTheDocument();
    });

    it('returns focus to the control that reopened the dialog', () => {
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
        fireEvent.click(screen.getByRole('button', { name: '채팅 닫기' }));

        const opener = screen.getByRole('button', { name: '여행봇 열기' });
        opener.focus();
        fireEvent.click(opener);
        expect(screen.getByRole('dialog', { name: 'K-RIDE 여행봇' })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(opener).toHaveFocus();
    });

    it('keeps Tab focus inside the dialog', () => {
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
        const closeButton = screen.getByRole('button', { name: '채팅 닫기' });
        const input = screen.getByRole('textbox', { name: '여행 질문' });

        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(input).toHaveFocus();
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(closeButton).toHaveFocus();
    });
});
