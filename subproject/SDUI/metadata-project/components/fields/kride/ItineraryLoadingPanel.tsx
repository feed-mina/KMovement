'use client';

import Rai from './atoms/Rai';
import { KrideSkeleton } from './atoms/KridePrimitives';
import { ITINERARY_LOADING_STAGES } from '@/lib/kride/itineraryLoadingStages';
import { useItineraryLoadingStage } from './useItineraryLoadingStage';

export default function ItineraryLoadingPanel() {
  const { stage, stageIndex } = useItineraryLoadingStage();

  return (
    <section
      className="kride-itinerary-loading"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={stage.message}
    >
      <div className="kride-itinerary-loading__hero">
        <div className="kride-itinerary-loading__mascot-wrap" aria-hidden="true">
          <Rai state="thinking" size={82} className="kride-itinerary-loading__mascot" />
        </div>
        <div className="kride-itinerary-loading__copy">
          <span className="kride-itinerary-loading__eyebrow">K-RIDE AI</span>
          <h2>라이가 여행 코스를 그리고 있어요</h2>
          <p key={stage.id}>{stage.message}</p>
        </div>
      </div>

      <ol className="kride-itinerary-loading__steps" aria-hidden="true">
        {ITINERARY_LOADING_STAGES.map((item, index) => (
          <li
            key={item.id}
            className="kride-itinerary-loading__step"
            data-active={index === stageIndex}
            data-visited={index < stageIndex}
          >
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
          </li>
        ))}
      </ol>

      <div className="kride-itinerary-loading__preview" aria-hidden="true">
        <div className="kride-itinerary-loading__preview-card">
          <KrideSkeleton height={10} />
          <KrideSkeleton width="68%" height={10} />
        </div>
        <div className="kride-itinerary-loading__preview-card">
          <KrideSkeleton height={10} />
          <KrideSkeleton width="82%" height={10} />
        </div>
        <div className="kride-itinerary-loading__preview-card">
          <KrideSkeleton height={10} />
          <KrideSkeleton width="56%" height={10} />
        </div>
      </div>
    </section>
  );
}
