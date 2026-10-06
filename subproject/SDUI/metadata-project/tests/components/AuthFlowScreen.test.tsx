import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthFlowScreen from '@/components/screens/AuthFlowScreen';

const replace = jest.fn();
const push = jest.fn();
const login = jest.fn();
const logout = jest.fn().mockResolvedValue(undefined);
const apiPost = jest.fn();
const apiGet = jest.fn();

let authState: any = {
    user: null,
    isLoggedIn: false,
    isLoading: false,
    login,
    logout,
};

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace, push }),
    useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/context/AuthContext', () => ({
    useAuth: () => authState,
}));

jest.mock('@/services/axios', () => ({
    __esModule: true,
    default: {
        post: (...args: any[]) => apiPost(...args),
        get: (...args: any[]) => apiGet(...args),
    },
}));

describe('F7 auth flow screen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { totalCount: 3 } }) }) as any;
        authState = {
            user: null,
            isLoggedIn: false,
            isLoading: false,
            login,
            logout,
        };
    });

    it('logs in with a full email, refreshes /me, and opens the profile', async () => {
        const currentUser = {
            isLoggedIn: true,
            email: 'mina@example.com',
            userId: 'mina',
            socialType: 'N',
            role: 'ROLE_USER',
        };
        apiPost.mockResolvedValueOnce({ status: 200 });
        apiGet.mockResolvedValueOnce({ data: currentUser });

        render(<AuthFlowScreen screenId="LOGIN_PAGE" refId={null} />);
        fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'mina@example.com' } });
        fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'safe-password' } });
        fireEvent.click(screen.getByRole('button', { name: '이메일로 로그인' }));

        await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
            '/api/auth/login',
            { user_email: 'mina@example.com', user_pw: 'safe-password' },
            { headers: { 'X-Platform': 'web' } },
        ));
        expect(apiGet).toHaveBeenCalledWith('/api/auth/me');
        expect(login).toHaveBeenCalledWith(currentUser);
        expect(replace).toHaveBeenCalledWith('/view/MY_PAGE');
    });

    it('shows profile data and clears the session through logout', async () => {
        authState = {
            user: {
                isLoggedIn: true,
                email: 'mina@example.com',
                userId: 'mina',
                socialType: 'K',
                role: 'ROLE_USER',
            },
            isLoggedIn: true,
            isLoading: false,
            login,
            logout,
        };

        render(<AuthFlowScreen screenId="MY_PAGE" refId={null} />);
        expect(screen.getByText('mina@example.com')).toBeVisible();
        expect(screen.getByText('카카오')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: '내 목록 보기' }));
        expect(push).toHaveBeenCalledWith('/view/KPOP_SAVED_ITEMS');

        // 벤치마킹 G5: 파괴적 행동은 확인 1단계를 거친다
        fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
        expect(logout).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '네, 로그아웃' }));
        await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    });
});

describe('MY_PAGE hierarchy (benchmark G5)', () => {
    it('shows avatar header, saved-count tiles and keeps logout out of the primary colour', async () => {
        authState = {
            user: { isLoggedIn: true, email: 'mina@example.com', userId: 'mina', socialType: 'K', role: 'ROLE_USER' },
            isLoggedIn: true, isLoading: false, login, logout,
        };
        render(<AuthFlowScreen screenId="MY_PAGE" refId={null} />);
        expect(screen.getByRole('heading', { name: 'mina' })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: '저장한 아티스트 3개 보기' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '저장한 이벤트 3개 보기' }));
        expect(push).toHaveBeenCalledWith('/view/KPOP_SAVED_ITEMS?kind=events&page=1');
        expect(screen.getByRole('button', { name: '로그아웃' })).not.toHaveClass('primary');
    });

    it('explains a failed logout and lets the user retry', async () => {
        logout.mockRejectedValueOnce(new Error('network'));
        authState = {
            user: { isLoggedIn: true, email: 'mina@example.com', userId: 'mina', socialType: 'N', role: 'ROLE_USER' },
            isLoggedIn: true, isLoading: false, login, logout,
        };
        render(<AuthFlowScreen screenId="MY_PAGE" refId={null} />);
        fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
        fireEvent.click(screen.getByRole('button', { name: '네, 로그아웃' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못했어요');
        expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
    });
});
