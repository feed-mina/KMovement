import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import KrideFocusNativeScreen, { extractChatMarkers } from '../screens/KrideFocusNativeScreen';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('../components/KrideMap', () => ({
  __esModule: true,
  default: ({ markers, style }: any) => {
    const { Text, View } = require('react-native');
    return <View testID="native-map" style={style}><Text>{`markers:${markers.length}`}</Text></View>;
  },
}));

jest.mock('@kride/core', () => ({
  authHeader: () => ({ Authorization: 'Bearer test-token' }),
  useOnboardingStore: (selector: (state: any) => unknown) => selector({
    duration: 'day',
    selectedArtists: [{ id: 1, name: 'BTS' }],
    selectedRegions: [{ id: 1, name: '서울' }],
    purposes: ['kculture'],
    budget: { min: 30000, max: 200000 },
  }),
}));

describe('KrideFocusNativeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          reply: '추천 코스를 준비했어요.',
          pois: [{ id: 1, name: '서울숲', lat: 37.544, lng: 127.037 }],
        },
      }),
    }) as jest.Mock;
  });

  it('keeps map and chat in separate sibling regions inside safe-area and keyboard layout', () => {
    const screen = render(<KrideFocusNativeScreen apiBase="https://example.com" />);

    expect(screen.getByTestId('kride-focus-screen')).toBeTruthy();
    expect(screen.getByTestId('kride-focus-keyboard')).toBeTruthy();
    expect(screen.getByTestId('kride-focus-map-region')).toBeTruthy();
    expect(screen.getByTestId('kride-focus-chat-region')).toBeTruthy();
    expect(screen.getByLabelText('여행봇 메시지')).toBeTruthy();
    expect(screen.getByText('서울 하루 코스 추천')).toBeTruthy();
  });

  it('closes and reopens the chat without removing the map', () => {
    const screen = render(<KrideFocusNativeScreen apiBase="https://example.com" />);

    fireEvent.press(screen.getByLabelText('여행봇 닫기'));
    expect(screen.queryByTestId('kride-focus-chat-region')).toBeNull();
    expect(screen.getByTestId('kride-focus-map-region')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('여행봇 열기'));
    expect(screen.getByTestId('kride-focus-chat-region')).toBeTruthy();
  });

  it('sends a message with the native session and updates the map from the response', async () => {
    const screen = render(<KrideFocusNativeScreen apiBase="https://example.com" />);
    fireEvent.changeText(screen.getByLabelText('여행봇 메시지'), '서울 코스 추천');
    fireEvent.press(screen.getByLabelText('메시지 보내기'));

    await waitFor(() => expect(screen.getByText('추천 코스를 준비했어요.')).toBeTruthy());
    expect(screen.getByText('markers:1')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api/v1/kride/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('normalizes explicit and itinerary place coordinates', () => {
    expect(extractChatMarkers({ pois: [{ name: 'A', latitude: 37.5, longitude: 127 }] })).toHaveLength(1);
    expect(extractChatMarkers({
      itinerary: { days: [{ morning: { places: [{ name: 'B', lat: 37.6, lng: 127.1 }] } }] },
    })).toEqual([expect.objectContaining({ name: 'B', lat: 37.6, lng: 127.1 })]);
  });
});
