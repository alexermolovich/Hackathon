import { Pressable } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useGigStore } from '@/lib/gig-store';

type ProfileTriggerProps = {
  onPress: () => void;
};

export function ProfileTrigger({ onPress }: ProfileTriggerProps) {
  const { profile, isDark } = useGigStore();

  return (
    <Pressable
      accessibilityLabel="Open profile"
      accessibilityRole="button"
      onPress={onPress}
      className={`h-11 w-11 items-center justify-center rounded-full border p-0.5 ${
        isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'
      }`}>
      <Avatar profile={profile} size={38} />
    </Pressable>
  );
}
