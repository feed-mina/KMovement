import React from 'react';
import { render } from '@testing-library/react-native';
import RootLayout from '../../app/_layout';

jest.mock('expo-router', () => ({
  Stack: () => require('react').createElement(require('react-native').Text, null, 'navigation'),
  ErrorBoundary: () => null,
}));

jest.mock('@kride/core', () => ({
  hydrateSession: jest.fn(() => new Promise(() => undefined)),
  setSessionStorage: jest.fn(),
}));

jest.mock('../../src/sessionStorage', () => ({
  secureSessionStorage: {},
}));

jest.mock('../../global.css', () => ({}));

describe('RootLayout', () => {
  it('mounts navigation while session hydration is pending', () => {
    expect(render(<RootLayout />).getByText('navigation')).toBeTruthy();
  });
});
