import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VerifyEmailScreen from '@/components/screens/VerifyEmailScreen';

const post = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams('email=mina%40example.com'),
    useRouter: () => ({ replace }),
}));
jest.mock('@/services/axios', () => ({ __esModule: true, default: { post: (...args: any[]) => post(...args) } }));

beforeEach(() => jest.clearAllMocks());

it('resends to the email from the URL and reports success only after the API succeeds', async () => {
    post.mockResolvedValueOnce({ status: 200 });
    render(<VerifyEmailScreen />);
    fireEvent.click(screen.getByRole('button', { name: '인증 메일 다시 받기' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('새 인증번호를 보냈습니다'));
    expect(post).toHaveBeenCalledWith('/api/auth/resend-code', { email: 'mina@example.com' }, expect.anything());
});

it('keeps the retry button available after mail delivery fails', async () => {
    post.mockRejectedValueOnce(new Error('SMTP unavailable'));
    render(<VerifyEmailScreen />);
    fireEvent.click(screen.getByRole('button', { name: '인증 메일 다시 받기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('보내지 못했습니다'));
    expect(screen.getByRole('button', { name: '인증 메일 다시 받기' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('submits the entered code and opens login after verification', async () => {
    post.mockResolvedValueOnce({ status: 200 });
    render(<VerifyEmailScreen />);
    fireEvent.change(screen.getByLabelText('인증번호'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '인증 완료' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/view/LOGIN_PAGE'));
    expect(post).toHaveBeenCalledWith('/api/auth/verify-code', { email: 'mina@example.com', code: '123456' }, expect.anything());
});
