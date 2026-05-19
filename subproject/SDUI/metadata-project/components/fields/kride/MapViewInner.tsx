'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  markers?: RouteMarker[];
  zoom?: number;
}

export default function MapViewInner({ center = [37.5665, 126.978], markers = [], zoom = 13 }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%', minHeight: '50vh', maxHeight: '60vh' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m, i) => {
        const lng = m.lng ?? m.lon;
        if (m.lat == null || lng == null) return null;
        return (
          <Marker key={`${m.name}-${i}`} position={[m.lat, lng]}>
            <Popup>{m.index != null ? `${m.index}. ` : ''}{m.name}</Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
