import React from 'react';
import { act, render } from '@testing-library/react-native';
import NativeItineraryLoadingPanel from '../components/NativeItineraryLoadingPanel';
import {
  ITINERARY_LOADING_STAGE_INTERVAL_MS,
  ITINERARY_LOADING_STAGES,
} from '@kride/core';
import { ITINERARY_LOADING_STAGES as WEB_LOADING_STAGES } from '../../../../../metadata-project/lib/kride/itineraryLoadingStages';

describe('NativeItineraryLoadingPanel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('uses the same ordered copy contract as the web loading panel', () => {
    expect(ITINERARY_LOADING_STAGES).toEqual(WEB_LOADING_STAGES);
  });

  it('announces each stage politely and clears its timer on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const screen = render(<NativeItineraryLoadingPanel />);
    const panel = screen.getByTestId('native-itinerary-loading');

    expect(panel.props.accessibilityLiveRegion).toBe('polite');
    expect(panel.props.accessibilityLabel).toBe(ITINERARY_LOADING_STAGES[0].message);

    act(() => jest.advanceTimersByTime(ITINERARY_LOADING_STAGE_INTERVAL_MS));
    expect(screen.getByTestId('native-itinerary-loading').props.accessibilityLabel)
      .toBe(ITINERARY_LOADING_STAGES[1].message);

    screen.unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
