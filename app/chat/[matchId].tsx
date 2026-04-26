import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import type { Profile } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { getUnreadMessageCount } from '@/lib/gig-utils';
import { resolveImageSource } from '@/lib/repo-images';
import { APP_NAME, CHAT_UNLOCK_COST_BSTS, CURRENCY_NAME } from '@/lib/sidehustle-config';

const GOOGLE_MAPS_URL_PATTERN = /(https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=[^\s]+)/;

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { profile, matches, messages, unlockChat, sendMessage, markMessagesRead, isDark } = useGigStore();
  const [draft, setDraft] = useState('');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseReason, setPurchaseReason] = useState<string | undefined>();

  const match = matches.find((item) => item.id === matchId);
  const threadMessages = useMemo(
    () => messages.filter((message) => message.match_id === matchId),
    [matchId, messages],
  );
  const isDoer = match?.doer_id === profile.id;
  const locked = Boolean(match && isDoer && !match.is_unlocked);
  const unreadMessageCount = match ? getUnreadMessageCount(match, messages, profile.id) : 0;

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white';

  useEffect(() => {
    if (match && !locked && unreadMessageCount > 0) {
      void markMessagesRead(match.id);
    }
  }, [locked, markMessagesRead, match, unreadMessageCount]);

  if (!match) {
    return (
      <SafeAreaView className={`flex-1 items-center justify-center px-6 ${shellClass}`}>
        <Text className={`mb-5 text-center text-3xl font-black ${titleClass}`}>Hustle not found</Text>
        <PrimaryButton label="Back" icon="arrow-back" tone="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const activeMatch = match;
  const participant = activeMatch.doer_id === profile.id ? activeMatch.poster : activeMatch.doer;
  const revealParticipant = !locked || !isDoer;

  async function handleUnlock() {
    const ok = await unlockChat(activeMatch.id);

    if (!ok) {
      setPurchaseReason(
        `You don't have enough ${CURRENCY_NAME} to unlock this chat. Unlocking this hustle costs ${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME}.`,
      );
      setPurchaseOpen(true);
    }
  }

  function confirmUnlock() {
    Alert.alert(
      'Unlock chat?',
      `Spend ${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME} to reveal this thread and message the Gigachad?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => void handleUnlock() },
      ],
    );
  }

  async function handleSend() {
    await sendMessage(activeMatch.id, draft);
    setDraft('');
  }

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className={`border-b px-5 py-3 ${isDark ? 'border-white/10' : 'border-zinc-200'}`}>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-white'}`}>
              <Ionicons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
            {revealParticipant ? <Avatar profile={participant} size={48} /> : <HiddenAvatar profile={participant} />}
            <View className="flex-1">
              <Text className="text-xs font-semibold text-orange-400">{APP_NAME}</Text>
              <View className="flex-row items-center gap-2">
                <Text className={`text-lg font-black ${titleClass}`}>{revealParticipant ? participant.username : 'Gigachad hidden'}</Text>
                {revealParticipant && <VerifiedBadge verified={participant.is_verified} compact />}
              </View>
              <Text className={`text-sm ${mutedClass}`} numberOfLines={1}>
                {activeMatch.task.title}
              </Text>
            </View>
            <CreditBadge
              credits={profile.credits}
              onPress={() => {
                setPurchaseReason(undefined);
                setPurchaseOpen(true);
              }}
            />
          </View>
        </View>

        <View className="flex-1">
          <ScrollView className="flex-1" contentContainerClassName="gap-3 px-5 py-5">
            <View className={`mb-2 rounded-[26px] border p-4 ${panelClass}`}>
              <Text className="text-xs font-bold text-violet-200">Your bid</Text>
              <Text className={`mt-1 text-base leading-6 ${titleClass}`}>{activeMatch.bid_note}</Text>
            </View>

            {threadMessages.map((message) => (
              <MessageBubble
                key={message.id}
                content={message.content}
                mine={message.sender_id === profile.id}
                isDark={isDark}
                panelClass={panelClass}
              />
            ))}
          </ScrollView>

          {locked && (
            <View className="absolute inset-0 items-center justify-center px-6">
              <BlurView intensity={34} tint="dark" className="absolute inset-0" />
              <View className={`w-full rounded-[32px] border border-violet/40 p-6 ${isDark ? 'bg-black/80' : 'bg-white/95'}`}>
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-violet">
                  <Ionicons name="lock-closed" size={30} color="#FFFFFF" />
                </View>
                <Text className={`mb-2 text-3xl font-black ${titleClass}`}>Chat locked</Text>
                <Text className={`mb-6 text-base leading-6 ${mutedClass}`}>
                  Spend {CHAT_UNLOCK_COST_BSTS} {CURRENCY_NAME} to reveal the thread and finalize the gig.
                </Text>
                <PrimaryButton label={`Unlock Chat (${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME})`} icon="flame" onPress={confirmUnlock} />
              </View>
            </View>
          )}
        </View>

        <View className={`border-t p-4 ${isDark ? 'border-white/10' : 'border-zinc-200'}`}>
          <View className="flex-row items-center gap-3">
            <TextInput
              editable={!locked}
              value={draft}
              onChangeText={setDraft}
              placeholder={locked ? 'Unlock chat to reply' : 'Message'}
              placeholderTextColor="#71717A"
              className={`min-h-12 flex-1 rounded-3xl border px-4 text-base ${
                isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-white text-zinc-950'
              }`}
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
        <BstPurchaseSheet
          visible={purchaseOpen}
          reason={purchaseReason}
          onClose={() => setPurchaseOpen(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HiddenAvatar({ profile }: { profile: Profile }) {
  const avatarSource = resolveImageSource(profile.avatar_url);

  return (
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/25">
      {avatarSource ? (
        <>
          <Image source={avatarSource} style={{ height: 48, width: 48 }} contentFit="cover" />
          <BlurView intensity={30} tint="dark" className="absolute inset-0" />
        </>
      ) : (
        <Ionicons name="person" size={22} color="#C4B5FD" />
      )}
    </View>
  );
}

function MessageBubble({
  content,
  mine,
  isDark,
  panelClass,
}: {
  content: string;
  mine: boolean;
  isDark: boolean;
  panelClass: string;
}) {
  const mapsMatch = content.match(GOOGLE_MAPS_URL_PATTERN);
  const textClass = mine || isDark ? 'text-white' : 'text-zinc-950';

  return (
    <View
      className={`max-w-[82%] rounded-[24px] px-4 py-3 ${
        mine ? 'self-end bg-violet' : `self-start border ${panelClass}`
      }`}>
      {mapsMatch ? (
        <Text className={`text-base leading-6 ${textClass}`}>
          {content.slice(0, mapsMatch.index)}
          <Text
            accessibilityRole="link"
            className="font-black underline"
            style={{ color: mine ? '#FFFFFF' : '#8B5CF6' }}
            onPress={() => void Linking.openURL(mapsMatch[0])}>
            Open Google Maps
          </Text>
        </Text>
      ) : (
        <Text className={`text-base leading-6 ${textClass}`}>{content}</Text>
      )}
    </View>
  );
}
