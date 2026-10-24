'use client';

import {useKrideReducedMotion} from '@/components/motion/KrideMotion';
import { useEffect, useRef, useState } from 'react';
import { buildMarkerInfoHtml, RouteMapData, RouteMapMarker } from './mapTypes';
import LeafletFallbackMap from './LeafletFallbackMap';
import { loadKakaoMaps } from './loadKakaoMaps';

type Props = {
  appKey: string;
  data: RouteMapData;
  selectedMarkerId?: string;
  onMarkerSelect: (marker: RouteMapMarker) => void;
};

function toKakaoLevel(zoom: number) {
  return Math.max(1, Math.min(14, 16 - Math.round(zoom)));
}

export default function KakaoRouteMap({ appKey, data, selectedMarkerId, onMarkerSelect }: Props) {
  const reducedMotion = useKrideReducedMotion();
  const [ready, setReady] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<Record<string, any>>({});
  const infoRefs = useRef<Record<string, any>>({});
  const [error, setError] = useState<{data: RouteMapData; key: string; message: string} | null>(null);

  useEffect(() => {
    let cancelled = false;
    const overlays: any[] = [];

    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;

        const center = new kakao.maps.LatLng(data.center[0], data.center[1]);
        const map = new kakao.maps.Map(containerRef.current, {
          center,
          level: toKakaoLevel(data.zoom),
        });
        mapRef.current = map;
        setReady((value) => value + 1);
        markerRefs.current = {};
        infoRefs.current = {};

        const bounds = new kakao.maps.LatLngBounds();
        const path: any[] = [];

        data.markers.forEach((marker) => {
          const position = new kakao.maps.LatLng(marker.lat, marker.lng);
          bounds.extend(position);
          path.push(position);

          const kakaoMarker = new kakao.maps.Marker({
            map,
            position,
            title: marker.name,
          });
          const infoWindow = new kakao.maps.InfoWindow({
            content: buildMarkerInfoHtml(marker, 'kakao'),
          });

          kakao.maps.event.addListener(kakaoMarker, 'click', () => {
            onMarkerSelect(marker);
            infoWindow.open(map, kakaoMarker);
          });

          overlays.push(kakaoMarker, infoWindow);
          markerRefs.current[marker.id] = kakaoMarker;
          infoRefs.current[marker.id] = infoWindow;
        });

        if (path.length > 1) {
          const polyline = new kakao.maps.Polyline({
            map,
            path,
            strokeWeight: 4,
            strokeColor: '#ef4444',
            strokeOpacity: 0.9,
            strokeStyle: 'solid',
          });
          overlays.push(polyline);
        }

        if (path.length > 0) {
          map.setBounds(bounds);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError({data, key: appKey, message: loadError?.message ?? 'Kakao Maps load failed.'});
      });

    return () => {
      cancelled = true;
      overlays.forEach((overlay) => overlay?.setMap?.(null));
      mapRef.current = null;
      markerRefs.current = {};
      infoRefs.current = {};
    };
  }, [appKey, data, onMarkerSelect]);

  useEffect(() => {
    if (!selectedMarkerId || !mapRef.current) return;
    const marker = data.markers.find((item) => item.id === selectedMarkerId);
    const kakaoMarker = markerRefs.current[selectedMarkerId];
    const infoWindow = infoRefs.current[selectedMarkerId];
    const kakao = window.kakao;
    if (!marker || !kakaoMarker || !infoWindow || !kakao?.maps) return;

    const position = new kakao.maps.LatLng(marker.lat, marker.lng);
    Object.entries(markerRefs.current).forEach(([id, item]) => item.setZIndex?.(id === selectedMarkerId ? 10 : 1));
    mapRef.current.setLevel(4, { animate: !reducedMotion });
    if (reducedMotion) mapRef.current.setCenter(position);
    else mapRef.current.panTo(position);
    infoWindow.open(mapRef.current, kakaoMarker);
  }, [data.markers, selectedMarkerId, ready, reducedMotion]);

  if (error?.data === data && error.key === appKey) {
    return (
      <>
        <LeafletFallbackMap data={data} selectedMarkerId={selectedMarkerId} onMarkerSelect={onMarkerSelect} />
        <div className="route-map__fallback-notice" role="status">
          Kakao Maps is unavailable. Showing the fallback map.
        </div>
      </>
    );
  }

  return <div ref={containerRef} className="route-map__canvas" />;
}
