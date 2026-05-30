'use client';

import dynamic from 'next/dynamic';
import type { RouteMapData } from './mapTypes';

const MapViewInner = dynamic(() => import('../MapViewInner'), { ssr: false });

type Props = {
  data: RouteMapData;
  selectedMarkerId?: string;
};

export default function LeafletFallbackMap({ data, selectedMarkerId }: Props) {
  return (
    <MapViewInner
      center={data.center}
      markers={data.markers}
      zoom={data.zoom}
      selectedMarkerId={selectedMarkerId}
    />
  );
}
