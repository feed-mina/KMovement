import {
  createKpopAnalysisJob,
  getKpopAnalysisJob,
  presignKpopAnalysisAsset,
  useSessionStore,
} from '@kride/core';

describe('K-POP analysis owner API', () => {
  beforeEach(() => {
    useSessionStore.setState({ accessToken: 'owner-token', isLoggedIn: true });
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    useSessionStore.setState({ accessToken: null, isLoggedIn: false });
  });

  it('unwraps ApiResponse data and sends the bearer token for presign', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sourceKey: 'kpop-analysis/7/source.jpg',
          uploadUrl: 'https://upload.example.com',
          headers: { 'Content-Type': 'image/jpeg' },
        },
      }),
    });

    const result = await presignKpopAnalysisAsset('https://api.example.com/', {
      contentType: 'image/jpeg',
      fileSize: 123,
    });

    expect(result.sourceKey).toBe('kpop-analysis/7/source.jpg');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/kpop/analysis-assets/presign',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer owner-token' }),
      }),
    );
  });

  it('adds the explicit consent scope and normalizes backend job fields', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { jobId: 41, celeryTaskId: 'task-41', status: 'PENDING' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            jobId: 41,
            status: 'SUCCESS',
            sourceDeleted: true,
            result: {
              grade: 'INSUFFICIENT_EVIDENCE',
              evidence: [{ type: 'visual_similarity', score: 0.2, source: 'uploaded-image' }],
            },
          },
        }),
      });

    const created = await createKpopAnalysisJob('https://api.example.com', {
      sourceKey: 'kpop-analysis/7/source.jpg',
      contentType: 'image/jpeg',
      idempotencyKey: 'once-41',
    });
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody).toEqual(expect.objectContaining({
      consented: true,
      consentScope: 'user-owned-image-analysis',
      idempotencyKey: 'once-41',
    }));
    expect(created.status).toBe('QUEUED');

    const snapshot = await getKpopAnalysisJob('https://api.example.com', 41);
    expect(snapshot.status).toBe('SUCCEEDED');
    expect(snapshot.sourceDeleted).toBe(true);
    expect(snapshot.result?.evidence).toEqual([
      { type: 'visual_similarity', score: 0.2, source: 'uploaded-image' },
    ]);
  });
});
