import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AiResultCardLeaf, UploadConsentLeaf } from '../kpopAnalysisLeaves';

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockPresignKpopAnalysisAsset = jest.fn();
const mockPutKpopAnalysisAsset = jest.fn();
const mockCreateKpopAnalysisJob = jest.fn();
const mockGetKpopAnalysisJob = jest.fn();
const mockDeleteKpopAnalysisSource = jest.fn();
const mockSaveKpopProductCandidate = jest.fn();
const mockDeleteKpopSavedItem = jest.fn();

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

jest.mock('@kride/core', () => ({
  KPOP_ANALYSIS_CONTENT_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  KPOP_ANALYSIS_MAX_BYTES: 10 * 1024 * 1024,
  presignKpopAnalysisAsset: (...args: unknown[]) => mockPresignKpopAnalysisAsset(...args),
  putKpopAnalysisAsset: (...args: unknown[]) => mockPutKpopAnalysisAsset(...args),
  createKpopAnalysisJob: (...args: unknown[]) => mockCreateKpopAnalysisJob(...args),
  getKpopAnalysisJob: (...args: unknown[]) => mockGetKpopAnalysisJob(...args),
  deleteKpopAnalysisSource: (...args: unknown[]) => mockDeleteKpopAnalysisSource(...args),
  saveKpopProductCandidate: (...args: unknown[]) => mockSaveKpopProductCandidate(...args),
  deleteKpopSavedItem: (...args: unknown[]) => mockDeleteKpopSavedItem(...args),
  canOpenKpopOfficialUrl: (candidate: { rightsChecked?: boolean; officialUrl?: string }) =>
    candidate.rightsChecked === true && candidate.officialUrl?.startsWith('https://') === true,
  isKpopAnalysisTerminal: (status?: string) => ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(String(status)),
  makeKpopAnalysisIdempotencyKey: () => 'kpop-mobile-key',
}));

// NativeWind's first React Native transform/render is cold on Windows and can
// consume 40+ seconds before the interaction starts.
jest.setTimeout(90000);

describe('K-POP mobile analysis leaves', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file:///outfit.jpg',
        fileName: 'outfit.jpg',
        fileSize: 5,
        mimeType: 'image/jpeg',
        width: 100,
        height: 100,
      }],
    });
    global.fetch = jest.fn().mockResolvedValue({
      blob: async () => ({ size: 5, type: 'image/jpeg' }),
    }) as jest.Mock;
    mockPresignKpopAnalysisAsset.mockResolvedValue({
      sourceKey: 'kpop-analysis/7/source.jpg',
      uploadUrl: 'https://upload.example.com',
      headers: {},
    });
    mockPutKpopAnalysisAsset.mockResolvedValue(undefined);
    mockCreateKpopAnalysisJob.mockResolvedValue({ jobId: 92, status: 'QUEUED' });
    mockSaveKpopProductCandidate.mockResolvedValue({ id: 44, itemType: 'PRODUCT_CANDIDATE', itemRef: 17 });
  });

  it('picks an owned photo, records explicit consent, and starts the owner job', async () => {
    const onAction = jest.fn();
    const screen = render(<UploadConsentLeaf apiBase="https://api.example.com" onAction={onAction} />);

    fireEvent.press(screen.getByLabelText('사진 선택'));
    await waitFor(() => expect(screen.getByText('outfit.jpg')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('소유 사진 분석 동의'));
    fireEvent.press(screen.getByLabelText('후보 분석 시작'));

    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect(mockCreateKpopAnalysisJob).toHaveBeenCalledWith('https://api.example.com', {
      sourceKey: 'kpop-analysis/7/source.jpg',
      contentType: 'image/jpeg',
      idempotencyKey: 'kpop-mobile-key',
    });
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionUrl: '/kpop/ai/result?jobId=92' }),
      expect.objectContaining({ jobId: 92 }),
    );
  });

  it('renders object evidence without a React child error and disables an already deleted source', async () => {
    mockGetKpopAnalysisJob.mockResolvedValue({
      jobId: 92,
      status: 'SUCCEEDED',
      sourceDeleted: true,
      result: {
        evidenceGrade: 'INSUFFICIENT_EVIDENCE',
        evidence: [{ type: 'visual_similarity', score: 0.33, source: 'uploaded-image' }],
        candidates: [],
      },
    });
    const screen = render(<AiResultCardLeaf apiBase="https://api.example.com" data={{ jobId: 92 }} />);

    await waitFor(() => expect(screen.getByText(/근거 유형 visual_similarity/)).toBeTruthy());
    expect(screen.getByText(/AI 결과는 비교를 시작하기 위한 후보/)).toBeTruthy();
    expect(screen.getByLabelText('원본 사진 삭제').props.accessibilityState.disabled).toBe(true);
  });

  it('saves an analysis candidate and hides an unchecked external link', async () => {
    mockGetKpopAnalysisJob.mockResolvedValue({
      jobId: 92,
      status: 'SUCCEEDED',
      result: {
        evidenceGrade: 'SIMILAR',
        candidates: [{
          id: 17,
          name: '무대 재킷 후보',
          evidenceGrade: 'SIMILAR',
          officialUrl: 'https://official.example/item',
          rightsChecked: false,
        }],
      },
    });
    const screen = render(<AiResultCardLeaf apiBase="https://api.example.com" data={{ jobId: 92 }} />);

    await waitFor(() => expect(screen.getByLabelText('후보 저장')).toBeTruthy());
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.press(screen.getByLabelText('후보 저장'));
    await waitFor(() => expect(mockSaveKpopProductCandidate).toHaveBeenCalledWith('https://api.example.com', 17));
    expect(screen.getByText('후보를 저장했습니다.')).toBeTruthy();
  });
});
