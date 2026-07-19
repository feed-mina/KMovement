import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HolyReviewPage from '@/app/admin/holy-review/page';
import api from '@/services/axios';

let mockAuthState: { user: { role: string } | null; isLoading: boolean } = {
  user: { role: 'ROLE_USER' },
  isLoading: false,
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/services/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const pendingItem = {
  poiSqno: 42,
  title: '실제 검수 대기 성지',
  addr: '서울시 성동구',
  artist: 'KRIDE',
  recommendReason: '공개 출처 확인 필요',
  source: 'UGC',
  sourceUrl: 'https://example.org/evidence',
  reviewStatus: 'PENDING',
};

describe('HolyReviewPage access and data states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { user: { role: 'ROLE_USER' }, isLoading: false };
  });

  it('does not request or expose the admin review UI to an ordinary user', () => {
    render(<HolyReviewPage />);

    expect(screen.getByRole('heading', { name: '관리자 검수 화면 접근 권한이 없습니다.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '성지 제보 검수' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인·공개' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows an explicit auth loading state without requesting pending items', () => {
    mockAuthState = { user: null, isLoading: true };
    render(<HolyReviewPage />);

    expect(screen.getByRole('status')).toHaveTextContent('계정 권한을 확인하는 중');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('renders only the pending items returned to an administrator', async () => {
    mockAuthState = { user: { role: 'ROLE_ADMIN' }, isLoading: false };
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [pendingItem] } });
    render(<HolyReviewPage />);

    expect(await screen.findByRole('heading', { name: '성지 제보 검수' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/admin/tour/holy/pending');
    expect(screen.getByText('실제 검수 대기 성지')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '출처 확인' })).toHaveAttribute('href', pendingItem.sourceUrl);
  });

  it('shows an explicit empty state for a valid empty response', async () => {
    mockAuthState = { user: { role: 'ROLE_ADMIN' }, isLoading: false };
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    render(<HolyReviewPage />);

    expect(await screen.findByText('검수 대기 제보가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('대기 0건')).toBeInTheDocument();
  });

  it('shows an error without substituting a sample item when loading fails', async () => {
    mockAuthState = { user: { role: 'ROLE_ADMIN' }, isLoading: false };
    (api.get as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<HolyReviewPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('검수 대기 제보를 불러오지 못했습니다.');
    expect(screen.queryByText('서울숲 K-POP 촬영 포인트')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인·공개' })).not.toBeInTheDocument();
  });

  it('submits an approval and removes the reviewed item', async () => {
    mockAuthState = { user: { role: 'ROLE_ADMIN' }, isLoading: false };
    (api.get as jest.Mock).mockResolvedValue({ data: [pendingItem] });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    render(<HolyReviewPage />);

    fireEvent.click(await screen.findByRole('button', { name: '승인·공개' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/admin/tour/holy/42/review', { action: 'APPROVE' }));
    expect(await screen.findByText('검수 대기 제보가 없습니다.')).toBeInTheDocument();
  });

  it('keeps the item and reports an error when review submission fails', async () => {
    mockAuthState = { user: { role: 'ROLE_ADMIN' }, isLoading: false };
    (api.get as jest.Mock).mockResolvedValue({ data: [pendingItem] });
    (api.post as jest.Mock).mockRejectedValue(new Error('save error'));
    render(<HolyReviewPage />);

    fireEvent.click(await screen.findByRole('button', { name: '반려' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('검수 결과를 저장하지 못했습니다.');
    expect(screen.getByText('실제 검수 대기 성지')).toBeInTheDocument();
  });
});
