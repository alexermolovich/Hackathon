import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type VerifiedBadgeProps = {
  verified: boolean;
  compact?: boolean;
};

export function VerifiedBadge({ verified, compact }: VerifiedBadgeProps) {
  const color = verified ? '#10B981' : '#737373';

  return (
    <View className="flex-row items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1">
      <Ionicons name={verified ? 'shield-checkmark' : 'shield-outline'} size={compact ? 13 : 15} color={color} />
      {!compact && (
        <Text className="text-xs font-semibold text-white">{verified ? 'Verified' : 'Selfie needed'}</Text>
      )}
    </View>
  );
}
