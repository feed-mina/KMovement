import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiResultCard, UploadConsent } from '@/components/kride/KpopAnalysis';

const presignKpopAnalysisAsset = jest.fn();
const putKpopAnalysisAsset = jest.fn();
const createKpopAnalysisJob = jest.fn();
const getKpopAnalysisJob = jest.fn();
const deleteKpopAnalysisSource = jest.fn();
const streamKpopAnalysisJob = jest.fn();
const saveKpopProductCandidate = jest.fn();
const deleteKpopSavedItem = jest.fn();

jest.mock('@kride/core', () => ({
  KPOP_ANALYSIS_CONTENT_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  KPOP_ANALYSIS_MAX_BYTES: 10 * 1024 * 1024,
  presignKpopAnalysisAsset: (...args: unknown[]) => presignKpopAnalysisAsset(...args),
  putKpopAnalysisAsset: (...args: unknown[]) => putKpopAnalysisAsset(...args),
  createKpopAnalysisJob: (...args: unknown[]) => createKpopAnalysisJob(...args),
  getKpopAnalysisJob: (...args: unknown[]) => getKpopAnalysisJob(...args),
  deleteKpopAnalysisSource: (...args: unknown[]) => deleteKpopAnalysisSource(...args),
  streamKpopAnalysisJob: (...args: unknown[]) => streamKpopAnalysisJob(...args),
  saveKpopProductCandidate: (...args: unknown[]) => saveKpopProductCandidate(...args),
  deleteKpopSavedItem: (...args: unknown[]) => deleteKpopSavedItem(...args),
  canOpenKpopOfficialUrl: (candidate: { rightsChecked?: boolean; officialUrl?: string }) =>
    candidate.rightsChecked === true && candidate.officialUrl?.startsWith('https://') === true,
  isKpopAnalysisTerminal: (status?: string) => ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(String(status)),
  makeKpopAnalysisIdempotencyKey: () => 'kpop-test-key',
}));

describe('K-POP web analysis leaves', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', { value: jest.fn(() => 'blob:preview'), configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: jest.fn(), configurable: true });
    presignKpopAnalysisAsset.mockResolvedValue({
      sourceKey: 'kpop-analysis/7/source.jpg',
      uploadUrl: 'https://upload.example.com',
      headers: { 'Content-Type': 'image/jpeg' },
    });
    putKpopAnalysisAsset.mockResolvedValue(undefined);
    createKpopAnalysisJob.mockResolvedValue({ jobId: 91, status: 'QUEUED' });
    saveKpopProductCandidate.mockResolvedValue({ id: 44, itemType: 'PRODUCT_CANDIDATE', itemRef: 17 });
  });

  it('requires explicit consent, uploads through the presigned URL contract, and routes by numeric job id', async () => {
    const onAction = jest.fn();
    const { container } = render(<UploadConsent apiBase="https://api.example.com" onAction={onAction} />);
    const file = new File(['photo'], 'outfit.jpg', { type: 'image/jpeg' });

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(screen.getByLabelText('다른 사진 선택')).toHaveAccessibleDescription(/지원 형식 JPG, PNG, WebP/);
    expect(screen.getByRole('img', { name: '선택한 분석 사진 미리보기: outfit.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '후보 분석 시작' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '후보 분석 시작' }));

    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect(presignKpopAnalysisAsset).toHaveBeenCalledWith('https://api.example.com', {
      contentType: 'image/jpeg',
      fileSize: file.size,
    });
    expect(putKpopAnalysisAsset).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'kpop-analysis/7/source.jpg' }), file);
    expect(createKpopAnalysisJob).toHaveBeenCalledWith('https://api.example.com', {
      sourceKey: 'kpop-analysis/7/source.jpg',
      contentType: 'image/jpeg',
      idempotencyKey: 'kpop-test-key',
    });
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionUrl: '/kpop/ai/result?jobId=91' }),
      expect.objectContaining({ jobId: 91 }),
    );
  });

  it('exposes numeric progress and connection state without relying on color', async () => {
    getKpopAnalysisJob.mockResolvedValue({ jobId: 91, status: 'RUNNING', progressPct: 42 });
    streamKpopAnalysisJob.mockImplementation(() => new Promise(() => undefined));

    render(<AiResultCard apiBase="https://api.example.com" data={{ jobId: 91 }} />);

    const progress = await screen.findByRole('progressbar', { name: '의상 후보 분석 진행률' });
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '100');
    expect(progress).toHaveAttribute('aria-valuenow', '42');
    expect(progress).toHaveAttribute('aria-valuetext', '42% 완료');
    expect(screen.getByText('42% 완료')).toBeInTheDocument();
    expect(await screen.findByText(/연결 방식: 실시간 상태 연결/)).toBeInTheDocument();
  });

  it('renders structured evidence safely and honors the backend sourceDeleted flag', async () => {
    getKpopAnalysisJob.mockResolvedValue({
      jobId: 91,
      status: 'SUCCEEDED',
      sourceDeleted: true,
      result: {
        evidenceGrade: 'INSUFFICIENT_EVIDENCE',
        evidence: [{ type: 'visual_similarity', score: 0.42, source: 'uploaded-image' }],
        candidates: [],
      },
    });

    render(<AiResultCard apiBase="https://api.example.com" data={{ jobId: 91 }} />);

    expect(await screen.findByText(/근거 유형 visual_similarity/)).toHaveTextContent('근거 참고 점수 0.42');
    expect(screen.getByRole('note')).toHaveTextContent('근거 수준: 근거 부족');
    expect(screen.getByText(/AI 결과는 비교를 시작하기 위한 후보/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '원본 사진 삭제됨' })).toBeDisabled();
    expect(streamKpopAnalysisJob).not.toHaveBeenCalled();
  });

  it('saves an analysis candidate and hides a link without explicit rights review', async () => {
    getKpopAnalysisJob.mockResolvedValue({
      jobId: 91,
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

    render(<AiResultCard apiBase="https://api.example.com" data={{ jobId: 91 }} />);
    const saveButton = await screen.findByRole('button', { name: '후보 저장' });
    expect(saveButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(saveButton);
    await waitFor(() => expect(saveKpopProductCandidate).toHaveBeenCalledWith('https://api.example.com', 17));
    expect(await screen.findByText('후보를 저장했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장 해제' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not expose internal upload errors in the live status message', async () => {
    presignKpopAnalysisAsset.mockRejectedValue(new Error('signed URL failed with internal-token-value'));
    const { container } = render(<UploadConsent apiBase="https://api.example.com" />);
    const file = new File(['photo'], 'outfit.jpg', { type: 'image/jpeg' });

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '후보 분석 시작' }));

    expect(await screen.findByRole('status')).toHaveTextContent('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(screen.queryByText(/internal-token-value/)).not.toBeInTheDocument();
  });
});
