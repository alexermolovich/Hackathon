import MapView, { Circle, Marker } from 'react-native-maps';

import type { Coordinates } from '@/lib/gig-types';

type DiscoveryMapProps = {
  center: Coordinates;
  radiusMiles: number;
};

export function DiscoveryMap({ center, radiusMiles }: DiscoveryMapProps) {
  return (
    <MapView
      style={{ height: 220 }}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }}
      customMapStyle={darkMapStyle}
      pointerEvents="none">
      <Marker coordinate={center} pinColor="#8B5CF6" />
      <Circle
        center={center}
        radius={radiusMiles * 1609.34}
        fillColor="rgba(139, 92, 246, 0.16)"
        strokeColor="rgba(139, 92, 246, 0.78)"
        strokeWidth={2}
      />
    </MapView>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#D4D4D8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];
