import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

type MarkerData = { id?: string; lat: number; lng: number; name?: string };
type Props = { provider?: 'google' | 'default'; center?: [number, number]; markers?: MarkerData[]; onMarkerPress?: (marker: MarkerData) => void };

type MapsModule = typeof import('react-native-maps');

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let cachedMapsModule: MapsModule | null | undefined;

// Keep the native map dependency lazy so a missing/misconfigured map module
// cannot crash the whole app during startup before any MAP_VIEW is rendered.
const getMapsModule = (): MapsModule | null => {
  if (isExpoGo) return null;
  if (cachedMapsModule !== undefined) return cachedMapsModule;

  try {
    cachedMapsModule = require('react-native-maps') as MapsModule;
  } catch {
    cachedMapsModule = null;
  }

  return cachedMapsModule;
};

export default function KrideMap({ provider = 'default', center = [37.5665, 126.978], markers = [], onMarkerPress }: Props) {
  const Maps = getMapsModule();

  if (!Maps) {
    return (
      <View className="h-full w-full items-center justify-center bg-neutral-100 px-6">
        <Text className="text-center text-sm text-neutral-500">
          {isExpoGo ? `지도는 개발 빌드에서 표시됩니다${'\n'}(Expo Go 미지원)` : '지도를 불러오지 못했습니다.'}
        </Text>
      </View>
    );
  }

  const MapView = Maps.default;
  const { Marker, Polyline, PROVIDER_GOOGLE } = Maps;
  return (
    <MapView
      style={StyleSheet.absoluteFill}
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
        <Polyline coordinates={markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))} strokeColor="#E50914" strokeWidth={4} />
      )}
    </MapView>
  );
}
