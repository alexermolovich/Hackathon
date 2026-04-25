import { Ionicons } from '@expo/vector-icons';
import { createElement } from 'react';
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
      {createElement('iframe', {
        src: 'https://www.google.com/maps?q=Rapid%20City%2C%20SD&z=11&output=embed',
        style: iframeStyle,
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        title: 'Rapid City Match Map',
      })}

      <View style={styles.mapScrim} pointerEvents="none" />

      {RAPID_CITY_TASK_DOTS.map((dot, index) => (
        <View
          key={dot.id}
          pointerEvents="none"
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

      <View style={styles.topPill} pointerEvents="none">
        <Ionicons name="map" size={13} color="#FFFFFF" />
        <Text style={styles.topPillText}>Rapid City match map</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    backgroundColor: '#E5E7EB',
    height: 260,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  mapScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
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

const iframeStyle = {
  border: 0,
  height: '100%',
  pointerEvents: 'none',
  width: '100%',
};
