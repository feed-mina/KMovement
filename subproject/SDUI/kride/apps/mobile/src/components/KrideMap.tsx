import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type MarkerData = { id?: string; lat: number; lng: number; name?: string };
type Props = {
  provider?: 'google' | 'default';
  center?: [number, number];
  markers?: MarkerData[];
  onMarkerPress?: (marker: MarkerData) => void;
  style?: StyleProp<ViewStyle>;
};

type MapsModule = typeof import('react-native-maps');

let cachedIsExpoGo: boolean | undefined;
let cachedMapsModule: MapsModule | null | undefined;

// Resolved lazily: componentMap imports this file at startup, so a top-level
// expo-constants access would run before any MAP_VIEW renders and could take
// the whole app down if the module is missing or misconfigured.
const isExpoGo = (): boolean => {
  if (cachedIsExpoGo !== undefined) return cachedIsExpoGo;

  try {
    const { default: Constants, ExecutionEnvironment } = require('expo-constants') as typeof import('expo-constants');
    cachedIsExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  } catch {
    cachedIsExpoGo = false;
  }

  return cachedIsExpoGo;
};

// Keep the native map dependency lazy so a missing/misconfigured map module
// cannot crash the whole app during startup before any MAP_VIEW is rendered.
const getMapsModule = (): MapsModule | null => {
  if (isExpoGo()) return null;
  if (cachedMapsModule !== undefined) return cachedMapsModule;

  try {
    cachedMapsModule = require('react-native-maps') as MapsModule;
  } catch {
    cachedMapsModule = null;
  }

  return cachedMapsModule;
};

export default function KrideMap({
  provider = 'default',
  center = [37.5665, 126.978],
  markers = [],
  onMarkerPress,
  style,
}: Props) {
  const Maps = getMapsModule();

  if (!Maps) {
    return (
      <View testID="kride-map-container" style={[styles.container, !style && styles.defaultSize, style, styles.fallback]}>
        <Text className="text-center text-sm text-neutral-500">
          {isExpoGo() ? `지도는 개발 빌드에서 표시됩니다.${'\n'}(Expo Go 미지원)` : '지도를 불러오지 못했습니다.'}
        </Text>
      </View>
    );
  }

  const MapView = Maps.default;
  const { Marker, Polyline, PROVIDER_GOOGLE } = Maps;
  return (
    <View testID="kride-map-container" style={[styles.container, !style && styles.defaultSize, style]}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={provider === 'google' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ latitude: center[0], longitude: center[1], latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      >
        {markers.map((marker: MarkerData) => (
          <Marker
            key={marker.id ?? `${marker.lat}-${marker.lng}`}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            title={marker.name}
            onPress={() => onMarkerPress?.(marker)}
          />
        ))}
        {markers.length > 1 && (
          <Polyline
            coordinates={markers.map((marker) => ({ latitude: marker.lat, longitude: marker.lng }))}
            strokeColor="#E50914"
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  defaultSize: {
    height: 256,
  },
  fallback: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
