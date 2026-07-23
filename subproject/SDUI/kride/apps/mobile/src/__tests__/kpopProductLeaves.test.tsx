import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProductCandidateCardLeaf, ProductSearchLeaf } from '../kpopProductLeaves';

const mockSearchKpopProductCandidates = jest.fn();
const mockGetKpopSavedItems = jest.fn();
const mockSaveKpopProductCandidate = jest.fn();
const mockDeleteKpopSavedItem = jest.fn();

jest.mock('@kride/core', () => ({
  searchKpopProductCandidates: (...args: unknown[]) => mockSearchKpopProductCandidates(...args),
  getKpopSavedItems: (...args: unknown[]) => mockGetKpopSavedItems(...args),
  saveKpopProductCandidate: (...args: unknown[]) => mockSaveKpopProductCandidate(...args),
  deleteKpopSavedItem: (...args: unknown[]) => mockDeleteKpopSavedItem(...args),
  canOpenKpopOfficialUrl: (candidate: { rightsChecked?: boolean; officialUrl?: string }) =>
    candidate.rightsChecked === true && candidate.officialUrl?.startsWith('https://') === true,
}));

jest.setTimeout(90000);

describe('K-POP mobile product leaves', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchKpopProductCandidates.mockResolvedValue([]);
    mockGetKpopSavedItems.mockResolvedValue([]);
    mockSaveKpopProductCandidate.mockResolvedValue({ id: 44, itemType: 'PRODUCT_CANDIDATE', itemRef: 17 });
  });

  it('keeps route ids hidden and submits the visible keyword filter', async () => {
    const view = render(<ProductSearchLeaf apiBase="https://api.example.com" data={{ artistId: '3', eventId: '9' }} />);
    await waitFor(() => expect(mockSearchKpopProductCandidates).toHaveBeenCalled());
    expect(view.queryByLabelText('아티스트 번호')).toBeNull();
    expect(view.queryByLabelText('이벤트 번호')).toBeNull();

    fireEvent.changeText(view.getByLabelText('상품 키워드'), '재킷');
    fireEvent.press(view.getByLabelText('후보 검색'));
    await waitFor(() => expect(mockSearchKpopProductCandidates).toHaveBeenLastCalledWith(
      'https://api.example.com',
      { q: '재킷', artistId: '3', eventId: '9', limit: 30 },
    ));
  });

  it('saves a candidate and does not expose an unchecked link', async () => {
    const view = render(<ProductCandidateCardLeaf apiBase="https://api.example.com" candidate={{
      id: 17,
      name: '무대 재킷 후보',
      evidenceGrade: 'INSUFFICIENT_EVIDENCE',
      officialUrl: 'https://official.example/item',
      rightsChecked: false,
      isSaved: true,
    }} />);

    expect(view.queryByRole('link')).toBeNull();
    expect(view.getByLabelText('근거 등급: 근거 부족 · 상품을 단정할 수 없음')).toBeTruthy();
    expect(view.getByLabelText('후보 저장').props.accessibilityState.selected).toBe(false);
    fireEvent.press(view.getByLabelText('후보 저장'));
    await waitFor(() => expect(view.getByText('이미 저장한 후보입니다.')).toBeTruthy());
    expect(view.getByLabelText('저장 해제').props.accessibilityState.selected).toBe(true);
  });

  it('labels a rights-checked external link and its browser behavior', () => {
    const view = render(<ProductCandidateCardLeaf apiBase="https://api.example.com" candidate={{
      id: 18,
      name: '공식 재킷 후보',
      evidenceGrade: 'SIMILAR',
      officialUrl: 'https://official.example/item',
      rightsChecked: true,
    }} />);

    const link = view.getByLabelText('공식 재킷 후보 권리 확인된 공식 출처 열기');
    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.accessibilityHint).toBe('외부 브라우저에서 열립니다.');
    expect(view.getByLabelText('근거 등급: 유사 후보')).toBeTruthy();
  });
});
