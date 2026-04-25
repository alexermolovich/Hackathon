import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useGigStore } from '@/lib/gig-store';

type VerifiedBadgeProps = {
  verified: boolean;
  compact?: boolean;
};

export function VerifiedBadge({ verified, compact }: VerifiedBadgeProps) {
  const { isDark } = useGigStore();
  const color = verified ? '#10B981' : '#737373';

  return (
    <View className={`flex-row items-center gap-1 rounded-full border px-2 py-1 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
      <Ionicons name={verified ? 'shield-checkmark' : 'shield-outline'} size={compact ? 13 : 15} color={color} />
      {!compact && (
        <Text className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-zinc-950'}`}>{verified ? 'Verified' : 'Selfie needed'}</Text>
      )}
    </View>
  );
}
