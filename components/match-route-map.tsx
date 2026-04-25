import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { RAPID_CITY_TASK_DOTS } from '@/lib/geo';
import type { Coordinates } from '@/lib/gig-types';

type MatchRouteMapProps = {
  origin: Coordinates;
  target: Coordinates;
};

export function MatchRouteMap(_props: MatchRouteMapProps) {
  return (
    <View style={styles.mapFrame}>
      <View style={[styles.road, { top: 44, left: -28, transform: [{ rotate: '-10deg' }] }]} />
      <View style={[styles.road, { top: 124, left: -28, transform: [{ rotate: '8deg' }] }]} />
      <View style={[styles.roadThin, { top: 82, left: -28, transform: [{ rotate: '-2deg' }] }]} />
      {RAPID_CITY_TASK_DOTS.map((dot, index) => (
        <View
          key={dot.id}
          style={[
            styles.randomDot,
            {
              backgroundColor: index === 0 ? '#10B981' : '#F59E0B',
              left: `${dot.xPercent}%`,
              top: `${dot.yPercent}%`,
            },
          ]}>
          <Text style={styles.randomDotText}>{index + 1}</Text>
        </View>
      ))}
      <View style={styles.topPill}>
        <Ionicons name="map" size={13} color="#FFFFFF" />
        <Text style={styles.topPillText}>Rapid City hustle map</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    backgroundColor: '#DDE5DA',
    height: 260,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  road: {
    position: 'absolute',
    width: '128%',
    height: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7D2C6',
  },
  roadThin: {
    position: 'absolute',
    width: '128%',
    height: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    opacity: 0.82,
  },
  randomDot: {
    position: 'absolute',
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  randomDotText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
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
