import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PartnerDashboardPage from '@/app/partner/dashboard/page';
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
  default: {
    get: jest.fn(),
  },
}));

const dashboard = {
  generatedAt: '2026-07-19T00:00:00.000Z',
  impressions: 1234,
  clicks: 120,
  conversions: 12,
  ctr: 9.7,
  conversionRate: 10,
  slots: [
    {
      slotId: 7,
      title: '실제 파트너 슬롯',
      status: 'ACTIVE',
      impressions: 1234,
      clicks: 120,
      conversions: 12,
      ctr: 9.7,
      conversionRate: 10,
    },
  ],
};

describe('PartnerDashboardPage access and data states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { user: { role: 'ROLE_USER' }, isLoading: false };
  });

  it('does not request or expose dashboard metrics to an ordinary user', () => {
    render(<PartnerDashboardPage />);

    expect(screen.getByRole('heading', { name: '파트너 대시보드 접근 권한이 없습니다.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '노출·전환 대시보드' })).not.toBeInTheDocument();
    expect(screen.queryByText('12,840')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows an explicit auth loading state without requesting metrics', () => {
    mockAuthState = { user: null, isLoading: true };

    render(<PartnerDashboardPage />);

    expect(screen.getByRole('status')).toHaveTextContent('계정 권한을 확인하는 중');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('loads the partner endpoint and renders only returned metrics', async () => {
    mockAuthState = { user: { role: 'ROLE_PARTNER' }, isLoading: false };
    (api.get as jest.Mock).mockResolvedValue({ data: { data: dashboard } });

    render(<PartnerDashboardPage />);

    expect(await screen.findByRole('heading', { name: '노출·전환 대시보드' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/partner/b2b/dashboard');
    expect(screen.getAllByText('1,234')).toHaveLength(2);
    expect(screen.getByText('실제 파트너 슬롯')).toBeInTheDocument();
    expect(screen.queryByText('12,840')).not.toBeInTheDocument();
  });

  it('uses the admin dashboard endpoint for an administrator', async () => {
    mockAuthState = { user: { role: 'ROLE_ADMIN' }, isLoading: false };
    (api.get as jest.Mock).mockResolvedValue({ data: dashboard });

    render(<PartnerDashboardPage />);

    await screen.findByRole('heading', { name: '노출·전환 대시보드' });
    expect(api.get).toHaveBeenCalledWith('/api/admin/b2b/dashboard');
  });

  it('shows an explicit empty slot state for a valid empty response', async () => {
    mockAuthState = { user: { role: 'ROLE_PARTNER' }, isLoading: false };
    (api.get as jest.Mock).mockResolvedValue({ data: { ...dashboard, slots: [] } });

    render(<PartnerDashboardPage />);

    expect(await screen.findByText('표시할 추천 슬롯 성과가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error without substituting demo metrics when the API fails', async () => {
    mockAuthState = { user: { role: 'ROLE_PARTNER' }, isLoading: false };
    (api.get as jest.Mock).mockRejectedValue(new Error('network error'));

    render(<PartnerDashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('파트너 지표를 불러오지 못했습니다.');
    expect(screen.queryByRole('heading', { name: '노출·전환 대시보드' })).not.toBeInTheDocument();
    expect(screen.queryByText('12,840')).not.toBeInTheDocument();
  });

  it('retries a failed request from the error state', async () => {
    mockAuthState = { user: { role: 'ROLE_PARTNER' }, isLoading: false };
    (api.get as jest.Mock)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ data: dashboard });

    render(<PartnerDashboardPage />);
    const retry = await screen.findByRole('button', { name: '다시 시도' });
    fireEvent.click(retry);

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('실제 파트너 슬롯')).toBeInTheDocument();
  });
});
