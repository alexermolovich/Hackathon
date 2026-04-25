import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useGigStore } from '@/lib/gig-store';

type CreditBadgeProps = {
  credits: number;
};

export function CreditBadge({ credits }: CreditBadgeProps) {
  const { isDark } = useGigStore();

  return (
    <View className={`flex-row items-center gap-2 rounded-full border border-violet/40 px-3 py-2 ${isDark ? 'bg-violet/20' : 'bg-violet/10'}`}>
      <Ionicons name="flash" size={15} color="#A78BFA" />
      <Text className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-950'}`}>{credits} credits</Text>
    </View>
  );
}
