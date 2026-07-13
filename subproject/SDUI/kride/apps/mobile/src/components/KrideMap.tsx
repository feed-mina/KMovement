import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet } from 'react-native';

type MarkerData = { id?: string; lat: number; lng: number; name?: string };
type Props = { provider?: 'google' | 'default'; center?: [number, number]; markers?: MarkerData[]; onMarkerPress?: (marker: MarkerData) => void };

export default function KrideMap({ provider = 'default', center = [37.5665, 126.978], markers = [], onMarkerPress }: Props) {
  return <MapView style={StyleSheet.absoluteFill} provider={provider === 'google' ? PROVIDER_GOOGLE : undefined} initialRegion={{ latitude: center[0], longitude: center[1], latitudeDelta: 0.08, longitudeDelta: 0.08 }}><>{markers.map((marker) => <Marker key={marker.id ?? `${marker.lat}-${marker.lng}`} coordinate={{ latitude: marker.lat, longitude: marker.lng }} title={marker.name} onPress={() => onMarkerPress?.(marker)} />)}{markers.length > 1 && <Polyline coordinates={markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))} strokeColor="#E50914" strokeWidth={4} />}</></MapView>;
}
