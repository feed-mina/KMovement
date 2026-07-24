import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCandidateCard, ProductSearch } from '@/components/kride/KpopProducts';

const searchKpopProductCandidates = jest.fn();
const getKpopSavedItems = jest.fn();
const saveKpopProductCandidate = jest.fn();
const deleteKpopSavedItem = jest.fn();

jest.mock('@kride/core', () => ({
  searchKpopProductCandidates: (...args: unknown[]) => searchKpopProductCandidates(...args),
  getKpopSavedItems: (...args: unknown[]) => getKpopSavedItems(...args),
  saveKpopProductCandidate: (...args: unknown[]) => saveKpopProductCandidate(...args),
  deleteKpopSavedItem: (...args: unknown[]) => deleteKpopSavedItem(...args),
  canOpenKpopOfficialUrl: (candidate: { rightsChecked?: boolean; officialUrl?: string }) =>
    candidate.rightsChecked === true && candidate.officialUrl?.startsWith('https://') === true,
}));

describe('K-POP web product leaves', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchKpopProductCandidates.mockResolvedValue([]);
    getKpopSavedItems.mockResolvedValue([]);
    saveKpopProductCandidate.mockResolvedValue({ id: 44, itemType: 'PRODUCT_CANDIDATE', itemRef: 17 });
  });

  it('keeps internal route filters hidden and searches with a user-facing keyword', async () => {
    render(<ProductSearch apiBase="https://api.example.com" data={{ artistId: '3', eventId: '9' }} />);
    await waitFor(() => expect(searchKpopProductCandidates).toHaveBeenCalledWith(
      'https://api.example.com',
      { q: '', artistId: '3', eventId: '9', limit: 30 },
    ));

    expect(screen.queryByLabelText('아티스트 번호')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('이벤트 번호')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('상품 키워드'), { target: { value: '재킷' } });
    fireEvent.click(screen.getByRole('button', { name: '후보 검색' }));
    await waitFor(() => expect(searchKpopProductCandidates).toHaveBeenLastCalledWith(
      'https://api.example.com',
      { q: '재킷', artistId: '3', eventId: '9', limit: 30 },
    ));
  });

  it('submits product search from the keyboard Enter key', async () => {
    const user = userEvent.setup();
    render(<ProductSearch apiBase="https://api.example.com" />);
    await waitFor(() => expect(searchKpopProductCandidates).toHaveBeenCalledTimes(1));

    const input = screen.getByRole('searchbox', { name: '상품 키워드' });
    await user.type(input, '재킷{Enter}');

    await waitFor(() => expect(searchKpopProductCandidates).toHaveBeenLastCalledWith(
      'https://api.example.com',
      { q: '재킷', artistId: '', eventId: '', limit: 30 },
    ));
  });

  it('handles duplicate save clearly and hides an unchecked external link', async () => {
    render(<ProductCandidateCard apiBase="https://api.example.com" candidate={{
      id: 17,
      name: '무대 재킷 후보',
      evidenceGrade: 'INSUFFICIENT_EVIDENCE',
      evidenceText: '시각 특징만 유사합니다.',
      officialUrl: 'https://official.example/item',
      rightsChecked: false,
      isSaved: true,
    }} />);

    expect(screen.getByRole('note')).toHaveTextContent('근거 수준: 근거 부족 · 상품을 단정할 수 없음');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: '후보 저장' });
    expect(saveButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(saveButton);
    expect(await screen.findByText('이미 저장한 후보입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장 해제' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('announces a safe search failure without exposing internal diagnostics', async () => {
    searchKpopProductCandidates.mockRejectedValue(new Error('database host and internal-token-value'));

    render(<ProductSearch apiBase="https://api.example.com" />);

    // The busy indicator is also role="status", so grab-and-assert races the
    // rejected search on slow machines — poll until the error copy lands.
    await waitFor(
      () => expect(screen.getByRole('status')).toHaveTextContent('검색을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'),
      { timeout: 15000 },
    );
    expect(screen.queryByText(/database host|internal-token-value/)).not.toBeInTheDocument();
  });
});
