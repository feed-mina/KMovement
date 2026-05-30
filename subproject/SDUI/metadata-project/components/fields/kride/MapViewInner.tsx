'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
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
}

function MapController({ markers, selectedMarkerId }: { markers: Array<RouteMarker | RouteMapMarker>; selectedMarkerId?: string }) {
  const map = useMap();
  
  useEffect(() => {
    if (!selectedMarkerId) return;
    const marker = markers.find(m => {
      const id = 'id' in m ? m.id : undefined;
      return id === selectedMarkerId;
    });
    if (!marker) return;
    
    const lng = marker.lng ?? ('lon' in marker ? marker.lon : undefined);
    if (marker.lat != null && lng != null) {
      map.flyTo([marker.lat, lng], 15, { animate: true, duration: 1.5 });
    }
  }, [map, markers, selectedMarkerId]);
  
  return null;
}

export default function MapViewInner({ center = [37.5665, 126.978], markers = [], zoom = 13, selectedMarkerId }: Props) {
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
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
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
        
        const num = m.index != null ? m.index + 1 : i + 1;
        const numberedIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="background-color: #dc2626; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid white;">${num}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        return (
          <Marker key={`${m.name}-${i}`} position={[m.lat, lng]} icon={numberedIcon}>
            <Popup>{m.index != null ? `${m.index + 1}. ` : ''}{m.name}</Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
