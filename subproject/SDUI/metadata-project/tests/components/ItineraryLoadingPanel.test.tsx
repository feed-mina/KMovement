import React from 'react';
import { act, render, screen } from '@testing-library/react';
import ItineraryLoadingPanel from '@/components/fields/kride/ItineraryLoadingPanel';
import {
  ITINERARY_LOADING_STAGE_INTERVAL_MS,
  ITINERARY_LOADING_STAGES,
} from '@/lib/kride/itineraryLoadingStages';

describe('ItineraryLoadingPanel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('announces one polite status and advances through the three brand messages', () => {
    render(<ItineraryLoadingPanel />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveAttribute('aria-label', ITINERARY_LOADING_STAGES[0].message);

    act(() => jest.advanceTimersByTime(ITINERARY_LOADING_STAGE_INTERVAL_MS));
    expect(status).toHaveAttribute('aria-label', ITINERARY_LOADING_STAGES[1].message);

    act(() => jest.advanceTimersByTime(ITINERARY_LOADING_STAGE_INTERVAL_MS));
    expect(status).toHaveAttribute('aria-label', ITINERARY_LOADING_STAGES[2].message);

    act(() => jest.advanceTimersByTime(ITINERARY_LOADING_STAGE_INTERVAL_MS));
    expect(status).toHaveAttribute('aria-label', ITINERARY_LOADING_STAGES[0].message);
  });

  it('clears the stage timer when the loading panel unmounts', () => {
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    const { unmount } = render(<ItineraryLoadingPanel />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    clearIntervalSpy.mockRestore();
  });
});
