import { View } from 'react-native';
import type { ComponentRegistry, SduiLeafProps } from '@kride/core';
import KrideMap from './components/KrideMap';

/** MAP_VIEW leaf — leaflet MapView on web becomes react-native-maps here. */
const MapViewLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const source = data ?? meta ?? {};
  const center = source.center ?? source.mapCenter;
  const markers = source.markers ?? source.mapMarkers ?? [];
  return (
    <View className="h-64 w-full overflow-hidden rounded-2xl">
      <KrideMap center={center} markers={markers} />
    </View>
  );
};

/**
 * Mobile-owned registry. Platform-neutral base leaves (GROUP/TEXT/BUTTON) are
 * merged by the engine from `createBaseComponentMap(rnPrimitives)`; this map adds
 * mobile-specific leaves on top. Unmapped component_types render null (safe).
 */
export const mobileComponentMap: ComponentRegistry = {
  MAP_VIEW: MapViewLeaf,
};
