'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
};

function getInitialProvider(data: RouteMapData): RouteMapProvider {
  if (typeof window !== 'undefined') {
    const storedProvider = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (isRouteMapProvider(storedProvider)) return storedProvider;
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

export default function RouteMap({ data }: Props) {
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
      window.localStorage.setItem(PROVIDER_STORAGE_KEY, nextProvider);
    }
  };

  const handleMarkerSelect = useCallback((marker: RouteMapMarker) => {
    setSelectedMarkerId(marker.id);
  }, []);

  useEffect(() => {
    const handleItinerarySelect = (event: Event) => {
      const detail = (event as CustomEvent<RouteMarkerSelectDetail>).detail;
      const marker = findSelectedMarker(data.markers, detail ?? {});
      if (marker) setSelectedMarkerId(marker.id);
    };

    window.addEventListener(ROUTE_MARKER_SELECT_EVENT, handleItinerarySelect);
    return () => window.removeEventListener(ROUTE_MARKER_SELECT_EVENT, handleItinerarySelect);
  }, [data.markers]);

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
      : <LeafletFallbackMap data={data} />;

  return (
    <div className="route-map">
      <div className="route-map__toolbar" aria-label="지도 제공자 선택">
        <button
          type="button"
          className={provider === 'kakao' ? 'route-map__provider route-map__provider--active' : 'route-map__provider'}
          onClick={() => selectProvider('kakao')}
          title={providerStatus.kakao ? '카카오맵' : '카카오맵 API 키 필요'}
        >
          Kakao
        </button>
        <button
          type="button"
          className={provider === 'google' ? 'route-map__provider route-map__provider--active' : 'route-map__provider'}
          onClick={() => selectProvider('google')}
          title={providerStatus.google ? 'Google Maps' : 'Google Maps API 키 필요'}
        >
          Google
        </button>
      </div>
      <div className="route-map__body">
        {data.markers.length === 0 ? (
          <div className="route-map__state">표시할 장소가 없습니다.</div>
        ) : map}
      </div>
    </div>
  );
}
