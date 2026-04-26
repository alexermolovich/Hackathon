import { Image } from 'expo-image';
import { View, Text } from 'react-native';

import type { Profile } from '@/lib/gig-types';
import { initials } from '@/lib/gig-utils';
import { resolveImageSource } from '@/lib/repo-images';

type AvatarProps = {
  profile: Profile;
  size?: number;
};

export function Avatar({ profile, size = 48 }: AvatarProps) {
  const avatarSource = resolveImageSource(profile.avatar_url);

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/30"
      style={{ width: size, height: size }}>
      {avatarSource ? (
        <Image source={avatarSource} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text className="font-bold text-white" style={{ fontSize: Math.max(14, size * 0.34) }}>
          {initials(profile.username)}
        </Text>
      )}
    </View>
  );
}
