'use client';
import dynamic from "next/dynamic";
import type { RouteMarker } from "./MapViewInner";

const MapViewInner = dynamic(() => import("./MapViewInner"), { ssr: false });

export default function MapView({ id, data }: any) {
  const center: [number, number] = data?.center ?? [37.5665, 126.978];
  // markers: 직접 data.markers 또는 data.mapData.markers에서 읽기
  const markers: RouteMarker[] = data?.markers ?? data?.mapData?.markers ?? [];
  const zoom: number = data?.zoom ?? 13;

  return (
    <div id={id} className="map-view w-full h-full min-h-[400px]">
      <MapViewInner center={center} markers={markers} zoom={zoom} />
    </div>
  );
}
