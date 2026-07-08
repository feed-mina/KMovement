'use client';

import React, { useState } from 'react';
import type { KrideItinerary } from '@/lib/types/krideChat';
import { KrideBadge, KrideButton, KrideMetric } from '../../atoms/KridePrimitives';

interface Props {
  itinerary: KrideItinerary;
  onApply?: (itinerary: KrideItinerary) => void;
}

export default function ItineraryCard({ itinerary, onApply }: Props) {
  const [openDay, setOpenDay] = useState<number>(0);
  const days = itinerary.days ?? [];

  const totalStops = days.reduce(
    (acc, day) => acc + (day.morning?.places?.length ?? 0) + (day.afternoon?.places?.length ?? 0),
    0,
  );

  return (
    <div className="kride-chat-itinerary">
      <div className="kride-chat-itinerary__head">
        <div>
          <KrideBadge tone="accent">ITINERARY</KrideBadge>
          <div className="kride-chat-itinerary__title">
            {itinerary.duration ?? `${days.length}일`} 추천 일정
          </div>
        </div>
        <div className="kride-chat-itinerary__metrics">
          <KrideMetric label="일정" value={`${days.length}일`} />
          <KrideMetric label="장소" value={totalStops} tone="accent" />
        </div>
      </div>

      <div className="kride-chat-itinerary__days">
        {days.map((day, index) => {
          const isOpen = openDay === index;
          const stops = (day.morning?.places?.length ?? 0) + (day.afternoon?.places?.length ?? 0);

          return (
            <div key={index} className="kride-chat-itinerary__day">
              <button
                type="button"
                onClick={() => setOpenDay(isOpen ? -1 : index)}
                className="kride-chat-itinerary__day-toggle"
                aria-expanded={isOpen}
              >
                <span>Day {day.day}</span>
                <span>{isOpen ? '접기' : '보기'} / {stops} stops</span>
              </button>

              {isOpen && (
                <div className="kride-chat-itinerary__slots">
                  {([
                    ['오전', day.morning] as const,
                    ['오후', day.afternoon] as const,
                  ]).map(([label, slot]) => (
                    <div key={label} className="kride-chat-itinerary__slot">
                      <div className="kride-chat-itinerary__slot-label">{label}</div>
                      {(slot?.places ?? []).map((place, placeIndex) => (
                        <div key={placeIndex} className="kride-chat-itinerary__place">
                          <span className="kride-chat-itinerary__place-dot" />
                          <div>
                            <div className="kride-chat-itinerary__place-name">{place.name}</div>
                            {(place.desc || place.description) && (
                              <div className="kride-chat-itinerary__place-desc">
                                {place.desc ?? place.description}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {(slot?.restaurants && slot.restaurants.length > 0) && (
                        <div className="kride-chat-itinerary__restaurants">
                          <div className="kride-chat-itinerary__restaurants-label">
                            {label} 주변 맛집
                          </div>
                          <div className="kride-chat-itinerary__restaurants-body">
                            {slot.restaurants.map((restaurant) => (
                              `[${restaurant.tag}] ${restaurant.name}(${restaurant.rating})`
                            )).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <KrideButton variant="primary" size="lg" className="kride-chat-itinerary__apply" onClick={() => onApply?.(itinerary)}>
        FOCUS 화면에 적용
      </KrideButton>
    </div>
  );
}
