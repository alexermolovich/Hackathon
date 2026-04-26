import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useGigStore } from '@/lib/gig-store';

type StarRatingProps = {
  label: string;
  value?: number | null;
  onRate: (rating: number) => void;
};

export function StarRating({ label, value, onRate }: StarRatingProps) {
  const { isDark } = useGigStore();

  return (
    <View className={`rounded-[22px] px-4 py-3 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Text className={`mb-2 text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
      <View className="flex-row items-center gap-1">
        {[1, 2, 3, 4, 5].map((rating) => {
          const filled = Boolean(value && rating <= value);

          return (
            <Pressable
              key={rating}
              accessibilityLabel={`${rating} star${rating === 1 ? '' : 's'}`}
              accessibilityRole="button"
              disabled={Boolean(value)}
              onPress={() => onRate(rating)}
              className="h-10 w-10 items-center justify-center rounded-full">
              <Ionicons name={filled ? 'star' : 'star-outline'} size={24} color={filled ? '#F59E0B' : '#A1A1AA'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
