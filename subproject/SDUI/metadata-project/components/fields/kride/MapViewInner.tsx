'use client';
// react-leaflet, leaflet 패키지 설치 필요: npm install react-leaflet leaflet @types/leaflet
// 설치 전에는 아래 placeholder가 표시됩니다.

export interface RouteMarker {
  lat: number;
  lng: number;
  name: string;
  index: number;
}

interface Props {
  center?: [number, number];
  markers?: RouteMarker[];
  zoom?: number;
}

export default function MapViewInner({ center, markers = [] }: Props) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-400 gap-2 text-sm">
      <span>🗺️</span>
      <span>지도를 표시하려면 react-leaflet 패키지를 설치하세요</span>
      <code className="text-xs text-gray-600">npm install react-leaflet leaflet @types/leaflet</code>
      {center && (
        <span className="text-xs text-gray-600">
          중심: {center[0].toFixed(4)}, {center[1].toFixed(4)} | 마커 {markers.length}개
        </span>
      )}
    </div>
  );
}
