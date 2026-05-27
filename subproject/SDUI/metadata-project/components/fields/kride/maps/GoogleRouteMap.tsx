'use client';

import { useEffect, useRef, useState } from 'react';
import { buildMarkerInfoHtml, RouteMapData, RouteMapMarker } from './mapTypes';
import { loadGoogleMaps } from './loadGoogleMaps';

type Props = {
  apiKey: string;
  data: RouteMapData;
  selectedMarkerId?: string;
  onMarkerSelect: (marker: RouteMapMarker) => void;
};

export default function GoogleRouteMap({ apiKey, data, selectedMarkerId, onMarkerSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<Record<string, any>>({});
  const infoRefs = useRef<Record<string, any>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const overlays: any[] = [];

    setError('');
    loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: { lat: data.center[0], lng: data.center[1] },
          zoom: data.zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        markerRefs.current = {};
        infoRefs.current = {};

        const bounds = new google.maps.LatLngBounds();
        const path: any[] = [];

        data.markers.forEach((marker) => {
          const position = { lat: marker.lat, lng: marker.lng };
          bounds.extend(position);
          path.push(position);

          const googleMarker = new google.maps.Marker({
            map,
            position,
            title: marker.name,
            label: String(marker.index + 1),
          });
          const infoWindow = new google.maps.InfoWindow({
            content: buildMarkerInfoHtml(marker, 'google'),
          });

          googleMarker.addListener('click', () => {
            onMarkerSelect(marker);
            infoWindow.open({ anchor: googleMarker, map });
          });

          overlays.push(googleMarker, infoWindow);
          markerRefs.current[marker.id] = googleMarker;
          infoRefs.current[marker.id] = infoWindow;
        });

        if (path.length > 1) {
          const polyline = new google.maps.Polyline({
            map,
            path,
            geodesic: true,
            strokeColor: '#ef4444',
            strokeOpacity: 0.9,
            strokeWeight: 4,
          });
          overlays.push(polyline);
        }

        if (path.length > 0) {
          map.fitBounds(bounds);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError?.message ?? 'Google Maps load failed.');
      });

    return () => {
      cancelled = true;
      overlays.forEach((overlay) => overlay?.setMap?.(null));
      mapRef.current = null;
      markerRefs.current = {};
      infoRefs.current = {};
    };
  }, [apiKey, data, onMarkerSelect]);

  useEffect(() => {
    if (!selectedMarkerId || !mapRef.current) return;
    const marker = data.markers.find((item) => item.id === selectedMarkerId);
    const googleMarker = markerRefs.current[selectedMarkerId];
    const infoWindow = infoRefs.current[selectedMarkerId];
    if (!marker || !googleMarker || !infoWindow) return;

    mapRef.current.panTo({ lat: marker.lat, lng: marker.lng });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? data.zoom, 14));
    infoWindow.open({ anchor: googleMarker, map: mapRef.current });
  }, [data.markers, data.zoom, selectedMarkerId]);

  if (error) {
    return <div className="route-map__state">{error}</div>;
  }

  return <div ref={containerRef} className="route-map__canvas" />;
}
