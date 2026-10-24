'use client';

import dynamic from 'next/dynamic';
import type { RouteMapData, RouteMapMarker } from './mapTypes';

const MapViewInner = dynamic(() => import('../MapViewInner'), { ssr: false });

type Props = {
  data: RouteMapData;
  selectedMarkerId?: string;
  onMarkerSelect?: (marker: RouteMapMarker) => void;
};

export default function LeafletFallbackMap({ data, selectedMarkerId, onMarkerSelect }: Props) {
  return (
    <MapViewInner
      center={data.center}
      markers={data.markers}
      zoom={data.zoom}
      selectedMarkerId={selectedMarkerId}
      onMarkerSelect={onMarkerSelect}
    />
  );
}
