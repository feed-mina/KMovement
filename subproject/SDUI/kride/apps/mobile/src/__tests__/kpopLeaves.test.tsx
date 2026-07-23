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

    expect(screen.getByLabelText('BTS 아티스트 이미지 없음')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('BTS 상세 보기'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionUrl: '/kpop/artists?artistId=7' }),
      expect.objectContaining({ id: 7 }),
    );

    expect(screen.getByLabelText('BTS 팔로우').props.accessibilityState.selected).toBe(false);
    fireEvent.press(screen.getByLabelText('BTS 팔로우'));
    await waitFor(() => expect(screen.getByText('팔로우했습니다.')).toBeTruthy());
    expect(screen.getByLabelText('BTS 팔로우 취소').props.accessibilityState.selected).toBe(true);
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

    fireEvent.press(screen.getByLabelText('Seoul fan route 저장'));

    await waitFor(() => expect(screen.getByText('로그인 후 이용해 주세요.')).toBeTruthy());
  });

  it('announces the event saved state with text and accessibility state', async () => {
    const screen = render(
      <EventCardLeaf data={{ id: 9, titleKo: 'Seoul fan route' }} apiBase="https://api.example.com" />,
    );

    const saveButton = screen.getByLabelText('Seoul fan route 저장');
    expect(saveButton.props.accessibilityState).toEqual({ disabled: false, selected: false });
    fireEvent.press(saveButton);

    await waitFor(() => expect(screen.getByText('이벤트를 저장했습니다.')).toBeTruthy());
    expect(screen.getByText('저장됨')).toBeTruthy();
    expect(screen.getByLabelText('Seoul fan route 저장').props.accessibilityState).toEqual({
      disabled: true,
      selected: true,
    });
  });
});
