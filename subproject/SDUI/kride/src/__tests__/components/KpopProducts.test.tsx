import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByText(/근거 부족 · 상품을 단정할 수 없음/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '후보 저장' }));
    expect(await screen.findByText('이미 저장한 후보입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장 해제' })).toBeInTheDocument();
  });
});
