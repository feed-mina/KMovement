'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from './loadGoogleMaps';
import { loadKakaoMaps } from './loadKakaoMaps';

type Props = {
  provider: 'kakao' | 'google';
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export default function HolyMapPicker({ provider, lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const latitude = Number(lat) || DEFAULT_CENTER.lat;
    const longitude = Number(lng) || DEFAULT_CENTER.lng;
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || '';
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    setError('');

    const setPoint = (nextLat: number, nextLng: number) => {
      if (!cancelled) onChange(nextLat.toFixed(6), nextLng.toFixed(6));
    };

    if (!containerRef.current) return;
    containerRef.current.replaceChildren();

    if (provider === 'kakao') {
      loadKakaoMaps(kakaoKey).then((kakao) => {
        if (cancelled || !containerRef.current) return;
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(latitude, longitude), level: 5,
        });
        mapRef.current = map;
        const marker = new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(latitude, longitude) });
        markerRef.current = marker;
        kakao.maps.event.addListener(map, 'click', (event: any) => {
          const point = event.latLng;
          marker.setPosition(point);
          setPoint(point.getLat(), point.getLng());
        });
      }).catch((cause: Error) => !cancelled && setError(cause.message));
    } else {
      loadGoogleMaps(googleKey).then((google) => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: latitude, lng: longitude }, zoom: 13,
        });
        mapRef.current = map;
        const marker = new google.maps.Marker({ map, position: { lat: latitude, lng: longitude } });
        markerRef.current = marker;
        map.addListener('click', (event: any) => {
          if (!event.latLng) return;
          marker.setPosition(event.latLng);
          setPoint(event.latLng.lat(), event.latLng.lng());
        });
      }).catch((cause: Error) => !cancelled && setError(cause.message));
    }

    return () => { cancelled = true; mapRef.current = null; markerRef.current = null; };
  }, [provider]);

  useEffect(() => {
    const position = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    if (provider === 'google' && markerRef.current?.setPosition) markerRef.current.setPosition(position);
    if (provider === 'kakao' && markerRef.current && window.kakao?.maps) {
      markerRef.current.setPosition(new window.kakao.maps.LatLng(position.lat, position.lng));
    }
  }, [lat, lng, provider]);

  return <div className="holy-map-picker">
    <div ref={containerRef} className="holy-map-picker__canvas" aria-label={`${provider === 'kakao' ? '카카오' : '구글'} 지도. 클릭해서 위치를 선택하세요.`} />
    {error ? <p className="holy-map-picker__error">지도를 불러오지 못했습니다. 좌표를 직접 입력하거나 키/도메인 설정을 확인하세요.</p> : <p className="holy-map-picker__hint">지도를 클릭하면 경도·위도가 자동으로 입력됩니다.</p>}
  </div>;
}
