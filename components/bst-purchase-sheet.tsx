import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';
import {
  BST_PACKAGES,
  CURRENCY_FULL_NAME,
  CURRENCY_NAME,
  DAILY_REWARD_BSTS,
  MONTHLY_STREAK_BONUS_BSTS,
  WEEKLY_STREAK_BONUS_BSTS,
} from '@/lib/sidehustle-config';

type BstPurchaseSheetProps = {
  visible: boolean;
  reason?: string;
  onClose: () => void;
};

export function BstPurchaseSheet({ visible, reason, onClose }: BstPurchaseSheetProps) {
  const { profile, buyBsts, claimConsistencyReward, isDark } = useGigStore();
  const [rewardCopy, setRewardCopy] = useState<string | null>(null);
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';

  function handleBuy(amount: number) {
    buyBsts(amount);
    setRewardCopy(`Added ${amount} ${CURRENCY_NAME}.`);
  }

  function handleReward() {
    const result = claimConsistencyReward();

    if (!result) {
      setRewardCopy('Daily reward already claimed.');
      return;
    }

    const bonuses = [
      result.weeklyBonus ? `weekly streak +${WEEKLY_STREAK_BONUS_BSTS}` : null,
      result.monthlyBonus ? `monthly streak +${MONTHLY_STREAK_BONUS_BSTS}` : null,
    ].filter(Boolean);
    setRewardCopy(
      `Claimed ${result.amount} ${CURRENCY_NAME} for day ${result.dailyStreak}${
        bonuses.length ? ` (${bonuses.join(', ')})` : ''
      }.`,
    );
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/65">
        <View className={`rounded-t-[34px] border px-5 pb-6 pt-5 ${panelClass}`}>
          <View className="mb-5 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-bold text-orange-400">{CURRENCY_FULL_NAME}</Text>
              <Text className={`text-3xl font-black ${titleClass}`}>Fuel your hustle</Text>
              {reason && <Text className={`mt-1 text-sm ${mutedClass}`}>{reason}</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          </View>

          <View className={`mb-4 rounded-[26px] border p-4 ${softClass}`}>
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className={`text-sm font-bold ${mutedClass}`}>Balance</Text>
                <Text className={`text-4xl font-black ${titleClass}`}>{profile.credits} {CURRENCY_NAME}</Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-full bg-orange-500/20">
                <Ionicons name="flame" size={28} color="#F97316" />
              </View>
            </View>
            <PrimaryButton
              label={`Claim daily +${DAILY_REWARD_BSTS}`}
              icon="calendar"
              tone="emerald"
              onPress={handleReward}
            />
          </View>

          <View className="mb-4 gap-3">
            {BST_PACKAGES.map((pack) => (
              <Pressable
                key={pack.id}
                accessibilityRole="button"
                onPress={() => handleBuy(pack.amount)}
                className={`min-h-16 flex-row items-center justify-between rounded-[26px] border px-4 ${softClass}`}>
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-violet/20">
                    <Ionicons name="flash" size={18} color="#8B5CF6" />
                  </View>
                  <View>
                    <Text className={`font-black ${titleClass}`}>{pack.label}</Text>
                    <Text className={`text-sm ${mutedClass}`}>+{pack.amount} {CURRENCY_NAME}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
              </Pressable>
            ))}
          </View>

          {rewardCopy && <Text className={`text-center text-sm font-semibold ${titleClass}`}>{rewardCopy}</Text>}
        </View>
      </View>
    </Modal>
  );
}
