import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

type MarkerData = { id?: string; lat: number; lng: number; name?: string };
type Props = { provider?: 'google' | 'default'; center?: [number, number]; markers?: MarkerData[]; onMarkerPress?: (marker: MarkerData) => void };

// react-native-maps ships a native module that is NOT bundled into Expo Go.
// Importing its JS is fine, but rendering <MapView> there throws at the native
// bridge. Detect Expo Go and skip loading the module entirely; a real map needs
// a development build (`expo run:android` / EAS dev client).
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const Maps = isExpoGo ? null : require('react-native-maps');

export default function KrideMap({ provider = 'default', center = [37.5665, 126.978], markers = [], onMarkerPress }: Props) {
  if (!Maps) {
    return (
      <View className="h-full w-full items-center justify-center bg-neutral-100 px-6">
        <Text className="text-center text-sm text-neutral-500">
          지도는 개발 빌드에서 표시됩니다{'\n'}(Expo Go 미지원)
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
