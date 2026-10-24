'use client';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {useKrideReducedMotion} from '@/components/motion/KrideMotion';
import 'leaflet/dist/leaflet.css';
import type { RouteMapMarker } from './maps/mapTypes';

// Leaflet 기본 마커 아이콘 수정 (webpack 번들링 이슈 해결)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

export interface RouteMarker {
  lat: number;
  lng?: number;
  lon?: number;
  name: string;
  index?: number;
}

interface Props {
  center?: [number, number];
  markers?: Array<RouteMarker | RouteMapMarker>;
  zoom?: number;
  selectedMarkerId?: string;
  onMarkerSelect?: (marker: RouteMapMarker) => void;
}

function MapController({ markers, selectedMarkerId }: { markers: Array<RouteMarker | RouteMapMarker>; selectedMarkerId?: string }) {
  const map = useMap();
  const reducedMotion = useKrideReducedMotion();
  
  useEffect(() => {
    if (!selectedMarkerId) return;
    const marker = markers.find(m => {
      const id = 'id' in m ? m.id : undefined;
      return id === selectedMarkerId;
    });
    if (!marker) return;
    
    const lng = marker.lng ?? ('lon' in marker ? marker.lon : undefined);
    if (marker.lat != null && lng != null) {
      map.stop();
      if (reducedMotion) map.setView([marker.lat, lng], 15, {animate: false});
      else map.flyTo([marker.lat, lng], 15, {animate: true, duration: 0.5});
    }
    return () => {map.stop();};
  }, [map, markers, selectedMarkerId, reducedMotion]);
  
  return null;
}

export default function MapViewInner({ center = [37.5665, 126.978], markers = [], zoom = 13, selectedMarkerId, onMarkerSelect }: Props) {
  const positions = markers
    .map((marker) => {
      const lng = marker.lng ?? ('lon' in marker ? marker.lon : undefined);
      return marker.lat == null || lng == null ? null : [marker.lat, lng] as [number, number];
    })
    .filter((position): position is [number, number] => position !== null);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      style={{ width: '100%', height: 'clamp(400px, 55vh, 560px)', minHeight: '400px' }}
    >
      <MapController markers={markers} selectedMarkerId={selectedMarkerId} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.length > 1 && <Polyline positions={positions} color="#ef4444" weight={4} />}
      {markers.map((m, i) => {
        const lng = m.lng ?? ('lon' in m ? m.lon : undefined);
        if (m.lat == null || lng == null) return null;
        
        return <NumberedRouteMarker key={'id' in m ? m.id : `${m.name}-${i}`} marker={m} number={m.index != null ? m.index + 1 : i + 1}
          lng={lng} selected={'id' in m && m.id === selectedMarkerId} onSelect={onMarkerSelect} />;
      })}
    </MapContainer>
  );
}


/** Leaflet owns the outer marker transform; only the inner dot scales. */
function NumberedRouteMarker({marker, number, lng, selected, onSelect}: {
  marker: RouteMarker | RouteMapMarker; number: number; lng: number; selected: boolean;
  onSelect?: (marker: RouteMapMarker) => void;
}) {
  const ref = useRef<L.Marker>(null);
  const icon = useMemo(() => L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<span class="route-pin__dot">${number}</span>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  }), [number]);
  useEffect(() => {
    const dot = ref.current?.getElement()?.querySelector<HTMLElement>('.route-pin__dot');
    if (dot) dot.dataset.selected = String(selected);
    ref.current?.setZIndexOffset(selected ? 1000 : 0);
  }, [selected]);
  return <Marker ref={ref} position={[marker.lat, lng]} icon={icon} title={marker.name} alt={`${number}. ${marker.name}`}
    eventHandlers={{click: () => {if ('id' in marker) onSelect?.(marker);}}}>
    <Popup>{number}. {marker.name}</Popup>
  </Marker>;
}
