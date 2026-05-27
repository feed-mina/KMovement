'use client';

import dynamic from 'next/dynamic';
import type { RouteMapData } from './mapTypes';

const MapViewInner = dynamic(() => import('../MapViewInner'), { ssr: false });

type Props = {
  data: RouteMapData;
};

export default function LeafletFallbackMap({ data }: Props) {
  return (
    <MapViewInner
      center={data.center}
      markers={data.markers}
      zoom={data.zoom}
    />
  );
}
