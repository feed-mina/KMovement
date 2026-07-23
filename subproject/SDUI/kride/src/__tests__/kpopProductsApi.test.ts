import {
  deleteKpopSavedItem,
  getKpopSavedItems,
  saveKpopProductCandidate,
  searchKpopProductCandidates,
  useSessionStore,
} from '@kride/core';

describe('K-POP product and saved-item API', () => {
  beforeEach(() => {
    useSessionStore.setState({ accessToken: 'owner-token', isLoggedIn: true });
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    useSessionStore.setState({ accessToken: null, isLoggedIn: false });
  });

  it('applies public search filters and exposes links only when rightsChecked is a real boolean', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          id: 17,
          name: 'Stage jacket candidate',
          evidenceGrade: 'SIMILAR',
          officialUrl: 'https://official.example/item',
          rightsChecked: 'true',
        }],
      }),
    });

    const rows = await searchKpopProductCandidates('https://api.example.com/', {
      q: ' jacket ', artistId: 3, eventId: 9, limit: 12,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/kpop/product-candidates?q=jacket&artistId=3&eventId=9&limit=12',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer owner-token' }),
      }),
    );
    expect(rows[0]).toEqual(expect.objectContaining({ id: 17, rightsChecked: false }));
  });

  it('normalizes the hydrated item response and uses the owner save/delete contract', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            id: 44,
            itemType: 'PRODUCT_CANDIDATE',
            itemRef: 17,
            item: {
              id: 17,
              name: 'Stage jacket candidate',
              evidenceGrade: 'INSUFFICIENT_EVIDENCE',
              rightsChecked: true,
              officialUrl: 'https://official.example/item',
            },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 44, itemType: 'PRODUCT_CANDIDATE', itemRef: 17 } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: null }) });

    const items = await getKpopSavedItems('https://api.example.com');
    expect(items[0].product).toEqual(expect.objectContaining({
      id: 17,
      savedItemId: 44,
      evidenceGrade: 'INSUFFICIENT_EVIDENCE',
      rightsChecked: true,
    }));

    await saveKpopProductCandidate('https://api.example.com', 17);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual({
      itemType: 'PRODUCT_CANDIDATE', itemRefId: 17,
    });

    await deleteKpopSavedItem('https://api.example.com', 44);
    expect(global.fetch).toHaveBeenLastCalledWith(
      'https://api.example.com/api/v1/kpop/saved-items/44',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
