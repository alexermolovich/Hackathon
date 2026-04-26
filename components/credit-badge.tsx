import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useGigStore } from '@/lib/gig-store';
import { CURRENCY_NAME } from '@/lib/sidehustle-config';

type CreditBadgeProps = {
  credits: number;
  onPress?: () => void;
};

export function CreditBadge({ credits, onPress }: CreditBadgeProps) {
  const { isDark } = useGigStore();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      className={`min-w-0 max-w-32 flex-row items-center gap-2 rounded-full border border-orange-400/40 px-3 py-2 ${
        isDark ? 'bg-orange-500/15' : 'bg-orange-50'
      }`}>
      <Ionicons name="flame" size={15} color="#F97316" />
      <Text className={`min-w-0 text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={1}>
        {credits} {CURRENCY_NAME}
      </Text>
    </Wrapper>
  );
}
