import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import KrideFocusScreen from '@/components/plugins/travel/KrideFocusScreen';

const mockSetFormData = jest.fn();
const mockHandleAction = jest.fn();
const mockPush = jest.fn();
const mockUseItinerary = jest.fn();
let mockItinerary = { data: null, isLoading: false, error: null as string | null, requiresLogin: false, candidatesUnavailable: false };
jest.mock('next/navigation', () => ({useRouter: () => ({push: mockPush})}));

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
    useKrideItinerary: (...args: unknown[]) => { mockUseItinerary(...args); return mockItinerary; },
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

function confirmCourse() {
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: '코스 만들기'}));
}
function openChat() {
    fireEvent.click(screen.getByRole('button', {name: '여행봇 열기'}));
    return within(screen.getByRole('dialog', {name: 'K-RIDE 여행봇'}));
}

describe('KrideFocusScreen chat dialog accessibility', () => {
    beforeEach(() => {
        mockSetFormData.mockClear();
        mockHandleAction.mockClear();
        mockPush.mockClear();
        mockUseItinerary.mockClear();
        mockItinerary = {data: null, isLoading: false, error: null, requiresLogin: false, candidatesUnavailable: false};
    });

    it('exposes an accessible modal and closes it with Escape', () => {
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
        confirmCourse();
        const dialog = openChat();
        expect(screen.getByRole('dialog', { name: 'K-RIDE 여행봇' })).toHaveAttribute('aria-modal', 'true');
        expect(dialog.getByRole('button', { name: '채팅 닫기' })).toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'K-RIDE 여행봇' })).not.toBeInTheDocument();
    });

    it('takes an authentication failure to the login page instead of retrying generation', () => {
        mockItinerary = {...mockItinerary, error: '로그인 후 AI 코스를 이용해 주세요.', requiresLogin: true};
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
        confirmCourse();
        fireEvent.click(screen.getByRole('button', {name: '로그인하기'}));
        expect(mockPush).toHaveBeenCalledWith('/view/LOGIN_PAGE');
        expect(screen.queryByRole('button', {name: '다시 시도'})).not.toBeInTheDocument();
    });

    it('keeps retry available for non-authentication failures', () => {
        mockItinerary = {...mockItinerary, error: '추천 서버에 문제가 있어요.'};
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
        confirmCourse();
        expect(screen.getByRole('button', {name: '다시 시도'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '로그인하기'})).not.toBeInTheDocument();
    });

    it('returns focus to the control that reopened the dialog', () => {
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
        confirmCourse();
        fireEvent.click(openChat().getByRole('button', { name: '채팅 닫기' }));

        const opener = screen.getByRole('button', { name: '여행봇 열기' });
        opener.focus();
        fireEvent.click(opener);
        expect(screen.getByRole('dialog', { name: 'K-RIDE 여행봇' })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(opener).toHaveFocus();
    });

    it('keeps Tab focus inside the dialog', () => {
        render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
        confirmCourse();
        const dialog = openChat();
        const closeButton = dialog.getByRole('button', { name: '채팅 닫기' });
        const input = dialog.getByRole('textbox', { name: '여행 질문' });

        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(input).toHaveFocus();
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(closeButton).toHaveFocus();
    });
});

it('does not ask users to retry an unavailable catalog', () => {
  mockItinerary = {...mockItinerary, error: '출처가 확인된 추천 자료가 아직 없습니다.', requiresLogin: false, candidatesUnavailable: true};
  render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
  confirmCourse();
  expect(screen.getByText('추천 자료를 준비 중이에요')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: '다시 시도'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: '홈으로'}));
  expect(mockPush).toHaveBeenCalledWith('/');
});

it('requires acknowledgement before enabling generation and forwards the chosen language', () => {
    mockItinerary = {data: null, isLoading: false, error: null, requiresLogin: false, candidatesUnavailable: false};
    render(<KrideFocusScreen screenId="KRIDE_FOCUS" refId={null} />);
    expect(screen.getByRole('button', {name: '코스 만들기'})).toBeDisabled();
    expect(mockUseItinerary.mock.calls.at(-1)?.[2]).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', {name: '안내 언어'}), {target: {value: 'ja'}});
    confirmCourse();
    expect(mockUseItinerary.mock.calls.at(-1)).toEqual(['KRIDE_FOCUS', expect.objectContaining({responseLocale: 'ja', acknowledgeUnverifiedConditions: true}), true]);
});
