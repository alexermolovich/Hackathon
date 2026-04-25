import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { Coordinates } from '@/lib/gig-types';

type DiscoveryMapProps = {
  center: Coordinates;
  radiusMiles: number;
};

export function DiscoveryMap({ radiusMiles }: DiscoveryMapProps) {
  return (
    <View className="h-48 items-center justify-center bg-white/10">
      <Ionicons name="navigate" size={34} color="#A78BFA" />
      <Text className="mt-3 text-sm font-semibold text-zinc-300">{radiusMiles} mile mobile map radius</Text>
    </View>
  );
}
