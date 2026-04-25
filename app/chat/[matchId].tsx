import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { useGigStore } from '@/lib/gig-store';

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { profile, matches, messages, unlockChat, sendMessage } = useGigStore();
  const [draft, setDraft] = useState('');

  const match = matches.find((item) => item.id === matchId);
  const threadMessages = useMemo(
    () => messages.filter((message) => message.match_id === matchId),
    [matchId, messages],
  );

  if (!match) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black px-6">
        <Text className="mb-5 text-center text-3xl font-black text-white">Match not found</Text>
        <PrimaryButton label="Back" icon="arrow-back" tone="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const activeMatch = match;
  const participant = activeMatch.doer_id === profile.id ? activeMatch.poster : activeMatch.doer;
  const locked = !activeMatch.is_unlocked;

  async function handleUnlock() {
    const ok = await unlockChat(activeMatch.id);

    if (!ok) {
      Alert.alert('Credits needed', 'Unlocking a matched chat costs 5 credits.');
    }
  }

  async function handleSend() {
    await sendMessage(activeMatch.id, draft);
    setDraft('');
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="border-b border-white/10 px-5 py-3">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </Pressable>
            <Avatar profile={participant} size={48} />
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-black text-white">{participant.username}</Text>
                <VerifiedBadge verified={participant.is_verified} compact />
              </View>
              <Text className="text-sm text-zinc-400" numberOfLines={1}>
                {activeMatch.task.title}
              </Text>
            </View>
            <CreditBadge credits={profile.credits} />
          </View>
        </View>

        <View className="flex-1">
          <ScrollView className="flex-1" contentContainerClassName="gap-3 px-5 py-5">
            <View className="mb-2 rounded-[26px] border border-white/10 bg-white/10 p-4">
              <Text className="text-xs font-bold text-violet-200">Your bid</Text>
              <Text className="mt-1 text-base leading-6 text-white">{activeMatch.bid_note}</Text>
            </View>

            {threadMessages.map((message) => {
              const mine = message.sender_id === profile.id;

              return (
                <View
                  key={message.id}
                  className={`max-w-[82%] rounded-[24px] px-4 py-3 ${
                    mine ? 'self-end bg-violet' : 'self-start border border-white/10 bg-white/10'
                  }`}>
                  <Text className="text-base leading-6 text-white">{message.content}</Text>
                </View>
              );
            })}
          </ScrollView>

          {locked && (
            <View className="absolute inset-0 items-center justify-center px-6">
              <BlurView intensity={34} tint="dark" className="absolute inset-0" />
              <View className="w-full rounded-[32px] border border-violet/40 bg-black/80 p-6">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-violet">
                  <Ionicons name="lock-closed" size={30} color="#FFFFFF" />
                </View>
                <Text className="mb-2 text-3xl font-black text-white">Chat locked</Text>
                <Text className="mb-6 text-base leading-6 text-zinc-300">
                  Spend 5 credits to reveal the thread and finalize the gig with {participant.username}.
                </Text>
                <PrimaryButton label="Unlock Chat (5 Credits)" icon="flash" onPress={() => void handleUnlock()} />
              </View>
            </View>
          )}
        </View>

        <View className="border-t border-white/10 p-4">
          <View className="flex-row items-center gap-3">
            <TextInput
              editable={!locked}
              value={draft}
              onChangeText={setDraft}
              placeholder={locked ? 'Unlock chat to reply' : 'Message'}
              placeholderTextColor="#71717A"
              className="min-h-12 flex-1 rounded-3xl border border-white/10 bg-white/10 px-4 text-base text-white"
            />
            <Pressable
              accessibilityRole="button"
              disabled={locked || !draft.trim()}
              onPress={() => void handleSend()}
              className={`h-12 w-12 items-center justify-center rounded-full ${
                locked || !draft.trim() ? 'bg-white/10' : 'bg-violet'
              }`}>
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
