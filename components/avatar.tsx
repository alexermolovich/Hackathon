import { Image } from 'expo-image';
import { View, Text } from 'react-native';

import type { Profile } from '@/lib/gig-types';
import { initials } from '@/lib/gig-utils';

type AvatarProps = {
  profile: Profile;
  size?: number;
};

export function Avatar({ profile, size = 48 }: AvatarProps) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/30"
      style={{ width: size, height: size }}>
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text className="font-bold text-white" style={{ fontSize: Math.max(14, size * 0.34) }}>
          {initials(profile.username)}
        </Text>
      )}
    </View>
  );
}
