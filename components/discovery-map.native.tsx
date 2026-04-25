import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import {
  DEFAULT_TASK_RADIUS_MILES,
  RAPID_CITY_CENTER,
  RAPID_CITY_TASK_DOTS,
  RAPID_CITY_VIEW_DELTA,
} from '@/lib/geo';
import type { Coordinates } from '@/lib/gig-types';

type DiscoveryMapProps = {
  center: Coordinates;
  radiusMiles: number;
};

export function DiscoveryMap({ radiusMiles }: DiscoveryMapProps) {
  const radius = radiusMiles || DEFAULT_TASK_RADIUS_MILES;

  return (
    <View style={styles.mapFrame}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType="standard"
        pitchEnabled={false}
        rotateEnabled={false}
        initialCamera={{
          center: RAPID_CITY_CENTER,
          heading: 0,
          pitch: 0,
          zoom: 10.9,
        }}
        initialRegion={{
          latitude: RAPID_CITY_CENTER.latitude,
          longitude: RAPID_CITY_CENTER.longitude,
          ...RAPID_CITY_VIEW_DELTA,
        }}
        pointerEvents="none">
        <Circle
          center={RAPID_CITY_CENTER}
          radius={radius * 1609.34}
          fillColor="rgba(139, 92, 246, 0.10)"
          strokeColor="rgba(139, 92, 246, 0.70)"
          strokeWidth={2}
        />
        {RAPID_CITY_TASK_DOTS.map((dot, index) => (
          <Marker
            key={dot.id}
            coordinate={dot.coordinate}
            pinColor={index === 0 ? '#10B981' : '#F59E0B'}
            title={`Gig ${index + 1}`}
          />
        ))}
      </MapView>

      <View style={styles.topPill} pointerEvents="none">
        <Ionicons name="map" size={13} color="#FFFFFF" />
        <Text style={styles.topPillText}>Rapid City - Google Maps - {radius} mi</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    height: 250,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  topPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
