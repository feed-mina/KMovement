import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ArtistCardLeaf, EventCardLeaf } from '../leaves';

jest.mock('@kride/core', () => ({
  authHeader: () => ({ Authorization: 'Bearer test-token' }),
}));

// The first NativeWind/React Native render is cold and can take well over the
// Jest default on Windows even though the interaction itself completes fast.
jest.setTimeout(30000);

describe('K-POP mobile cards', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    }) as jest.Mock;
  });

  it('opens the selected artist detail and follows with the mobile bearer token', async () => {
    const onAction = jest.fn();
    const screen = render(
      <ArtistCardLeaf
        data={{ id: 7, nameKo: 'BTS' }}
        meta={{ actionType: 'ROUTE' }}
        onAction={onAction}
        apiBase="https://api.example.com"
      />,
    );

    fireEvent.press(screen.getByLabelText('View BTS details'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionUrl: '/kpop/artists?artistId=7' }),
      expect.objectContaining({ id: 7 }),
    );

    fireEvent.press(screen.getByLabelText('Follow BTS'));
    await waitFor(() => expect(screen.getByText('Following')).toBeTruthy());
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/kpop/artists/7/follow',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('shows an authentication message when event bookmarking returns 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
    const screen = render(
      <EventCardLeaf data={{ id: 9, titleKo: 'Seoul fan route' }} apiBase="https://api.example.com" />,
    );

    fireEvent.press(screen.getByLabelText('Bookmark Seoul fan route'));

    await waitFor(() => expect(screen.getByText('Login required')).toBeTruthy());
  });
});
