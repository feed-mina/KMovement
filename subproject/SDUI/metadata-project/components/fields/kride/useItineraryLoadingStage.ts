'use client';

import { useEffect, useState } from 'react';
import {
  ITINERARY_LOADING_STAGE_INTERVAL_MS,
  ITINERARY_LOADING_STAGES,
  nextItineraryLoadingStage,
} from '@/lib/kride/itineraryLoadingStages';

export function useItineraryLoadingStage(active = true) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStageIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setStageIndex((current) => nextItineraryLoadingStage(current));
    }, ITINERARY_LOADING_STAGE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [active]);

  return {
    stage: ITINERARY_LOADING_STAGES[stageIndex],
    stageIndex,
  };
}
