'use client';
import { useMemo } from "react";
import RouteMap from "./maps/RouteMap";
import { normalizeRouteMapData } from "./maps/normalizeRouteMapData";

export default function MapView({ id, data }: any) {
  const routeMapData = useMemo(() => normalizeRouteMapData(data), [data]);

  return (
    <div id={id} className="map-view w-full h-full min-h-[400px]">
      <RouteMap data={routeMapData} />
    </div>
  );
}
