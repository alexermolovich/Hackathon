import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type CreditBadgeProps = {
  credits: number;
};

export function CreditBadge({ credits }: CreditBadgeProps) {
  return (
    <View className="flex-row items-center gap-2 rounded-full border border-violet/40 bg-violet/20 px-3 py-2">
      <Ionicons name="flash" size={15} color="#A78BFA" />
      <Text className="text-sm font-bold text-white">{credits} credits</Text>
    </View>
  );
}
