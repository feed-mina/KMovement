'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {MotionButton} from '@/components/motion/KrideMotion';
import {motion} from 'framer-motion';
import {useId} from 'react';
import KakaoRouteMap from './KakaoRouteMap';
import GoogleRouteMap from './GoogleRouteMap';
import LeafletFallbackMap from './LeafletFallbackMap';
import {
  isRouteMapProvider,
  normalizePlaceName,
  ROUTE_MARKER_SELECT_EVENT,
  RouteMapData,
  RouteMapMarker,
  RouteMapProvider,
  RouteMarkerSelectDetail,
} from './mapTypes';

const PROVIDER_STORAGE_KEY = 'kride:route-map-provider';

type Props = {
  data: RouteMapData;
  onSelect?: (marker: RouteMapMarker) => void;
};

function getInitialProvider(data: RouteMapData): RouteMapProvider {
  if (typeof window !== 'undefined') {
    try {
      const storedProvider = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
      if (isRouteMapProvider(storedProvider)) return storedProvider;
    } catch { /* Storage can be disabled by the browser. */ }
  }

  if (data.provider) return data.provider;

  const envDefault = process.env.NEXT_PUBLIC_KRIDE_MAP_DEFAULT_PROVIDER;
  return isRouteMapProvider(envDefault) ? envDefault : 'kakao';
}

function findSelectedMarker(markers: RouteMapMarker[], detail: RouteMarkerSelectDetail) {
  if (detail.id) {
    const byId = markers.find((marker) => marker.id === detail.id);
    if (byId) return byId;
  }

  if (detail.name) {
    const targetName = normalizePlaceName(detail.name);
    const byName = markers.find((marker) => normalizePlaceName(marker.name) === targetName);
    if (byName) return byName;
  }

  if (typeof detail.index === 'number') {
    return markers.find((marker) => marker.index === detail.index);
  }

  return undefined;
}

export default function RouteMap({ data, onSelect }: Props) {
  const providerIndicatorId = useId();
  const [provider, setProvider] = useState<RouteMapProvider>(() => getInitialProvider(data));
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>();
  const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? '';
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const providerStatus = useMemo(() => ({
    kakao: Boolean(kakaoAppKey),
    google: Boolean(googleApiKey),
  }), [googleApiKey, kakaoAppKey]);

  const selectProvider = (nextProvider: RouteMapProvider) => {
    setProvider(nextProvider);
    if (typeof window !== 'undefined') {
      try {window.localStorage.setItem(PROVIDER_STORAGE_KEY, nextProvider);} catch { /* Session-only provider choice. */ }
    }
  };

  const handleMarkerSelect = useCallback((marker: RouteMapMarker) => {
    setSelectedMarkerId(marker.id);
    onSelect?.(marker);
  }, [onSelect]);

  useEffect(() => {
    const handleItinerarySelect = (event: Event) => {
      const detail = (event as CustomEvent<RouteMarkerSelectDetail>).detail;
      const marker = findSelectedMarker(data.markers, detail ?? {});
      if (marker) handleMarkerSelect(marker);
    };

    window.addEventListener(ROUTE_MARKER_SELECT_EVENT, handleItinerarySelect);
    return () => window.removeEventListener(ROUTE_MARKER_SELECT_EVENT, handleItinerarySelect);
  }, [data.markers, handleMarkerSelect]);

  const hasSelectedProviderKey = providerStatus[provider];
  const map = hasSelectedProviderKey && provider === 'kakao'
    ? (
      <KakaoRouteMap
        appKey={kakaoAppKey}
        data={data}
        selectedMarkerId={selectedMarkerId}
        onMarkerSelect={handleMarkerSelect}
      />
    )
    : hasSelectedProviderKey && provider === 'google'
      ? (
        <GoogleRouteMap
          apiKey={googleApiKey}
          data={data}
          selectedMarkerId={selectedMarkerId}
          onMarkerSelect={handleMarkerSelect}
        />
      )
      : <LeafletFallbackMap data={data} selectedMarkerId={selectedMarkerId} onMarkerSelect={handleMarkerSelect} />;

  return (
    <div className="route-map">
      <div className="route-map__toolbar">
        <span className="route-map__toolbar-label">지도</span>
        <div className="route-map__providers" role="group" aria-label="지도 제공자 선택">
          {(['kakao', 'google'] as const).map((item) => <MotionButton
            key={item}
            type="button"
            aria-pressed={provider === item}
            className={provider === item ? 'route-map__provider route-map__provider--active' : 'route-map__provider'}
            onClick={() => selectProvider(item)}
            title={providerStatus[item] ? (item === 'kakao' ? '카카오맵' : 'Google Maps') : '지도 키가 없어 대체 지도를 표시합니다'}
          >
            {provider === item && <motion.span aria-hidden="true" className="route-map__provider-indicator" layoutId={providerIndicatorId} transition={{duration: 0.18}} />}
            <span className="route-map__provider-label">{item === 'kakao' ? 'Kakao' : 'Google'}</span>
          </MotionButton>)}
        </div>
        {!hasSelectedProviderKey && <span className="route-map__provider-note">OpenStreetMap 대체 지도</span>}
      </div>
      <div className="route-map__body relative w-full h-full">
        {map}
        {data.markers.length === 0 && (
          <div role="status" className="route-map__state absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white font-semibold z-[400] pointer-events-none rounded-b-2xl text-center px-4">
            <span>{data.hasItinerary ? '일정은 생성되었지만 장소 위치를 확인하지 못했습니다.' : '표시할 장소가 없습니다.'}</span>
            <span className="text-sm mt-2 text-gray-200">
              {data.hasItinerary
                ? '장소 주소를 확인하거나 잠시 후 다시 시도해주세요.'
                : <>우측 하단 [AI 여행봇 채팅]을 열어<br/>일정을 생성해주세요!</>}
            </span>
          </div>
        )}
        {/*
          위치를 못 찾은 장소가 있어도 지도 위에 배너를 띄우지 않는다.
          지도를 가리는 데다 "어느 장소가 문제인지"를 알려주지 못해서다.
          대신 일정 목록의 해당 장소 옆에 표시한다(RouteNode).
        */}
      </div>
    </div>
  );
}
