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

        fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
        await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    });
});
