import React from 'react';
import { render } from '@testing-library/react-native';

describe('KrideMap', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('react-native-maps');
    jest.unmock('expo-constants');
  });

  it('renders a fallback instead of crashing when the native map module is unavailable', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment: 'standalone' },
      ExecutionEnvironment: { StoreClient: 'storeClient' },
    }));
    jest.doMock('react-native-maps', () => {
      throw new Error('native module missing');
    });

    const KrideMap = require('../components/KrideMap').default;

    expect(render(<KrideMap />).getByText('지도를 불러오지 못했습니다.')).toBeTruthy();
  });

  it('does not crash at import time or render when expo-constants is unavailable', () => {
    jest.doMock('expo-constants', () => {
      throw new Error('expo-constants not linked');
    });
    jest.doMock('react-native-maps', () => {
      throw new Error('native module missing');
    });

    // componentMap imports KrideMap during app startup, so the module itself
    // must load even when expo-constants cannot be required.
    const KrideMap = require('../components/KrideMap').default;

    expect(render(<KrideMap />).getByText('지도를 불러오지 못했습니다.')).toBeTruthy();
  });
});
