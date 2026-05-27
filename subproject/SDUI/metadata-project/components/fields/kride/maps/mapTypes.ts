'use client';

export type RouteMapProvider = 'kakao' | 'google';

export type RouteMapSlot = 'morning' | 'afternoon' | 'evening' | string;

export type RouteMapMarker = {
  id: string;
  index: number;
  day?: number;
  slot?: RouteMapSlot;
  name: string;
  description?: string;
  address?: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  externalUrls?: {
    kakao?: string;
    google?: string;
  };
};

export type RouteMapData = {
  provider?: RouteMapProvider;
  center: [number, number];
  zoom: number;
  markers: RouteMapMarker[];
};

export type RouteMarkerSelectDetail = {
  id?: string;
  name?: string;
  index?: number;
  day?: number;
  slot?: string;
};

export const DEFAULT_ROUTE_MAP_CENTER: [number, number] = [37.5665, 126.978];
export const DEFAULT_ROUTE_MAP_ZOOM = 13;
export const ROUTE_MARKER_SELECT_EVENT = 'kride:route-marker-select';

export function isRouteMapProvider(value: unknown): value is RouteMapProvider {
  return value === 'kakao' || value === 'google';
}

export function normalizePlaceName(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getExternalMapUrls(marker: Pick<RouteMapMarker, 'name' | 'lat' | 'lng' | 'externalUrls'>) {
  const encodedName = encodeURIComponent(marker.name || 'place');
  const latLng = `${marker.lat},${marker.lng}`;

  return {
    kakao: marker.externalUrls?.kakao ?? `https://map.kakao.com/link/map/${encodedName},${latLng}`,
    google: marker.externalUrls?.google ?? `https://www.google.com/maps/search/?api=1&query=${latLng}`,
  };
}

export function buildMarkerInfoHtml(marker: RouteMapMarker, provider: RouteMapProvider) {
  const links = getExternalMapUrls(marker);
  const targetUrl = provider === 'kakao' ? links.kakao : links.google;
  const dayLabel = marker.day ? `Day ${marker.day}` : '';
  const slotLabel = marker.slot ? String(marker.slot) : '';
  const meta = [dayLabel, slotLabel].filter(Boolean).join(' · ');
  const detail = marker.description || marker.address || '';

  return `
    <div style="min-width:180px;max-width:240px;padding:10px 12px;font-family:Arial,sans-serif;color:#111827;">
      <div style="font-size:12px;color:#e11d48;font-weight:700;margin-bottom:4px;">${marker.index + 1}</div>
      <div style="font-size:14px;font-weight:700;line-height:1.35;">${escapeHtml(marker.name)}</div>
      ${meta ? `<div style="font-size:11px;color:#6b7280;margin-top:3px;">${escapeHtml(meta)}</div>` : ''}
      ${detail ? `<div style="font-size:12px;color:#4b5563;margin-top:6px;line-height:1.4;">${escapeHtml(detail)}</div>` : ''}
      <a href="${targetUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin-top:8px;font-size:12px;color:#2563eb;text-decoration:none;">지도에서 열기</a>
    </div>
  `;
}
