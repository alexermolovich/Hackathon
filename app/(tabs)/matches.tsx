import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { ProfilePanel } from '@/components/profile-panel';
import { ProfileTrigger } from '@/components/profile-trigger';
import { StarRating } from '@/components/star-rating';
import { VerifiedBadge } from '@/components/verified-badge';
import type { EnrichedMatch, Profile } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { getTaskCategoryLabels, getUnreadMessageCount, hasUnseenAcceptedOffer } from '@/lib/gig-utils';
import { resolveImageSource } from '@/lib/repo-images';
import { gigHref } from '@/lib/routes';
import { APP_NAME, CHAT_UNLOCK_COST_BSTS, CURRENCY_NAME } from '@/lib/sidehustle-config';

export default function MatchesScreen() {
  const {
    profile,
    matches,
    messages,
    unlockChat,
    requestMatchCompletion,
    rateMatch,
    markAcceptedOffersSeen,
    isDark,
  } = useGigStore();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const readyHustles = matches.filter((match) => match.doer_id === profile.id && match.status === 'matched');
  const pendingBids = matches.filter((match) => match.doer_id === profile.id && match.status === 'pending');
  const completed = matches.filter((match) => match.doer_id === profile.id && match.status === 'completed');
  const unseenAcceptedIds = useMemo(
    () => readyHustles.filter((match) => hasUnseenAcceptedOffer(match, profile.id)).map((match) => match.id),
    [readyHustles, profile.id],
  );

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';

  async function handleUnlock(matchId: string) {
    const ok = await unlockChat(matchId);

    if (!ok) {
      setPurchaseOpen(true);
    }
  }

  function confirmUnlock(match: EnrichedMatch) {
    Alert.alert(
      'Unlock this hustle?',
      `Spend ${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME} to reveal the Gigachad and open chat for "${match.task.title}"?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => void handleUnlock(match.id) },
      ],
    );
  }

  async function handleRate(matchId: string, rating: number) {
    const ok = await rateMatch(matchId, rating);

    if (!ok) {
      Alert.alert('Rating not saved', 'Only completed hustles can be rated.');
    }
  }

  function confirmCompletionRequest(match: EnrichedMatch) {
    Alert.alert(
      'Mark this hustle complete?',
      `This asks ${match.poster.username || 'the Gigachad'} to confirm before it becomes completed.`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => void requestMatchCompletion(match.id) },
      ],
    );
  }

  useFocusEffect(
    useCallback(() => {
      if (unseenAcceptedIds.length > 0) {
        void markAcceptedOffersSeen(unseenAcceptedIds);
      }
    }, [markAcceptedOffersSeen, unseenAcceptedIds]),
  );

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-orange-400">{APP_NAME}</Text>
            <Text className={`text-3xl font-black ${titleClass}`}>Hustles</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <CreditBadge credits={profile.credits} onPress={() => setPurchaseOpen(true)} />
            <ProfileTrigger onPress={() => setProfileOpen(true)} />
          </View>
        </View>

        <SectionHeader title="Ready to unlock" count={readyHustles.length} icon="lock-open" />
        {readyHustles.length === 0 ? (
          <EmptyState copy="When a Gigachad picks your counter bid, the hustle lands here." />
        ) : (
          readyHustles.map((match) => (
            <HustleCard
              key={match.id}
              match={match}
              newAcceptance={hasUnseenAcceptedOffer(match, profile.id)}
              unreadMessageCount={getUnreadMessageCount(match, messages, profile.id)}
              onUnlock={() => confirmUnlock(match)}
              onComplete={() => confirmCompletionRequest(match)}
            />
          ))
        )}

        <SectionHeader title="Pending bids" count={pendingBids.length} icon="time" />
        {pendingBids.length === 0 ? (
          <EmptyState copy="Your right-swipe bids wait here until the Gigachad picks you." />
        ) : (
          pendingBids.map((match) => <PendingBid key={match.id} match={match} />)
        )}

        <SectionHeader title="Finished hustles" count={completed.length} icon="medal" />
        {completed.length === 0 ? (
          <EmptyState copy="Completed gigs become Hustles Completed on your profile." />
        ) : (
          completed.map((match) => (
            <CompletedHustleCard key={match.id} match={match} onRate={(rating) => void handleRate(match.id, rating)} />
          ))
        )}
      </ScrollView>

      <Modal transparent animationType="slide" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`h-[88%] overflow-hidden rounded-t-[34px] border ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <ProfilePanel onClose={() => setProfileOpen(false)} />
          </View>
        </View>
      </Modal>

      <BstPurchaseSheet
        visible={purchaseOpen}
        reason={`Unlocking a hustle costs ${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME}.`}
        onClose={() => setPurchaseOpen(false)}
      />
    </SafeAreaView>
  );
}

function SectionHeader({ title, count, icon }: { title: string; count: number; icon: keyof typeof Ionicons.glyphMap }) {
  const { isDark } = useGigStore();

  return (
    <View className="mb-3 mt-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color="#A78BFA" />
        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{title}</Text>
      </View>
      <Text className={`rounded-full px-3 py-1 text-xs font-bold ${isDark ? 'bg-white/10 text-zinc-300' : 'bg-white text-zinc-700'}`}>{count}</Text>
    </View>
  );
}

function HustleCard({
  match,
  newAcceptance,
  onUnlock,
  onComplete,
  unreadMessageCount,
}: {
  match: EnrichedMatch;
  newAcceptance: boolean;
  onUnlock: () => void;
  onComplete: () => void;
  unreadMessageCount: number;
}) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const reveal = match.is_unlocked;
  const taskImageSource = resolveImageSource(match.task.image_urls[0]);
  const completionRequested = Boolean(match.doer_completed_at);
  const categoriesText = getTaskCategoryLabels(match.task).join(', ');

  return (
    <View className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-4 flex-row items-center gap-3">
        {reveal ? <Avatar profile={match.poster} size={54} /> : <HiddenAvatar poster={match.poster} />}
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className={`text-lg font-black ${titleClass}`} numberOfLines={1}>
              {reveal ? match.poster.username : 'Gigachad hidden'}
            </Text>
            {reveal && <VerifiedBadge verified={match.poster.is_verified} compact />}
          </View>
          <Text className={`text-sm ${mutedClass}`} numberOfLines={1}>{match.task.title}</Text>
        </View>
        <View className="items-end gap-2">
          {newAcceptance ? <NotificationBadge label="New" /> : null}
          {unreadMessageCount > 0 ? <NotificationBadge label={String(unreadMessageCount)} /> : null}
          <Ionicons name={reveal ? 'chatbubble-ellipses' : 'lock-closed'} size={22} color="#A78BFA" />
        </View>
      </View>

      {taskImageSource && (
        <Image source={taskImageSource} style={{ borderRadius: 22, height: 128, marginBottom: 16, width: '100%' }} contentFit="cover" />
      )}

      <View className="mb-4 flex-row flex-wrap gap-2">
        <Chip icon="pricetag" label={categoriesText} />
        <Chip icon="navigate-circle" label={match.task.location_label} />
        <Chip icon="calendar" label={match.task.date_window || 'Flexible'} />
      </View>

      <Text className={`mb-4 text-sm leading-5 ${mutedClass}`} numberOfLines={3}>{match.task.description}</Text>

      <View className="mb-4 flex-row gap-3">
        <Metric label="Your bid" value={`$${match.counter_bid}`} />
        <Metric label="Budget" value={`$${match.task.budget}`} />
      </View>

      <View className={`mb-4 rounded-[24px] p-4 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
        <Text className="mb-1 text-xs font-bold text-orange-400">Your note</Text>
        <Text className={`text-base leading-6 ${titleClass}`}>{match.bid_note}</Text>
      </View>

      {reveal ? (
        <View className="gap-3">
          <Link href={{ pathname: '/chat/[matchId]', params: { matchId: match.id } }} asChild>
            <Pressable accessibilityRole="button" className="min-h-12 flex-row items-center justify-center gap-2 rounded-3xl bg-violet px-5">
              <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">Open Chat</Text>
            </Pressable>
          </Link>
          <PrimaryButton
            label={completionRequested ? 'Waiting for confirmation' : 'Mark Completed'}
            icon={completionRequested ? 'time' : 'checkmark'}
            tone="ghost"
            disabled={completionRequested}
            onPress={onComplete}
          />
        </View>
      ) : (
        <PrimaryButton
          label={`Unlock (${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME})`}
          icon="flame"
          onPress={onUnlock}
        />
      )}
    </View>
  );
}

function NotificationBadge({ label }: { label: string }) {
  return (
    <View className="min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-1">
      <Text className="text-xs font-black text-white">{label}</Text>
    </View>
  );
}

function CompletedHustleCard({ match, onRate }: { match: EnrichedMatch; onRate: (rating: number) => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const reveal = match.is_unlocked;

  return (
    <View className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'}`}>
      <View className="mb-4 flex-row items-center gap-3">
        {reveal ? <Avatar profile={match.poster} size={54} /> : <HiddenAvatar poster={match.poster} />}
        <View className="flex-1">
          <Text className={`text-lg font-black ${titleClass}`} numberOfLines={1}>
            {match.task.title}
          </Text>
          <Text className={`text-sm ${mutedClass}`} numberOfLines={1}>
            {reveal ? `Completed for Gigachad ${match.poster.username}` : 'Hustle completed'}
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={24} color="#34D399" />
      </View>

      <StarRating
        label={match.poster_rating_by_doer ? `You rated the Gigachad ${match.poster_rating_by_doer}/5` : 'Rate Gigachad'}
        value={match.poster_rating_by_doer}
        onRate={onRate}
      />

      <Link href={gigHref(match.task.id)} asChild>
        <Pressable accessibilityRole="button" className={`mt-3 min-h-12 flex-row items-center justify-center gap-2 rounded-3xl border px-5 ${isDark ? 'border-white/10 bg-white/10' : 'border-emerald-200 bg-white'}`}>
          <Ionicons name="briefcase" size={18} color={isDark ? '#FFFFFF' : '#065F46'} />
          <Text className={`text-sm font-bold ${isDark ? 'text-white' : 'text-emerald-900'}`}>Open Gig</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function PendingBid({ match }: { match: EnrichedMatch }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <View className={`mb-3 rounded-[26px] border p-4 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className={`flex-1 text-lg font-black ${titleClass}`} numberOfLines={1}>{match.task.title}</Text>
        <Text className="rounded-full bg-violet/20 px-3 py-1 text-xs font-bold text-violet-300">${match.counter_bid}</Text>
      </View>
      <Text className={`mb-2 text-sm ${mutedClass}`}>{match.availability_window || 'Flexible availability'}</Text>
      <Text className={`text-sm leading-5 ${mutedClass}`}>{match.bid_note}</Text>
    </View>
  );
}

function HiddenAvatar({ poster }: { poster: Profile }) {
  const avatarSource = resolveImageSource(poster.avatar_url);

  return (
    <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/25">
      {avatarSource ? (
        <>
          <Image source={avatarSource} style={{ height: 56, width: 56 }} contentFit="cover" />
          <BlurView intensity={30} tint="dark" className="absolute inset-0" />
        </>
      ) : (
        <Ionicons name="person" size={24} color="#C4B5FD" />
      )}
    </View>
  );
}

function Chip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`flex-row items-center gap-1 rounded-full px-3 py-2 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Ionicons name={icon} size={14} color="#8B5CF6" />
      <Text className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`flex-1 rounded-[22px] px-3 py-3 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Text className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
      <Text className={`mt-1 text-xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{value}</Text>
    </View>
  );
}

function EmptyState({ copy }: { copy: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`mb-3 rounded-[26px] border border-dashed p-5 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-300 bg-white'}`}>
      <Text className={`text-sm leading-5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{copy}</Text>
    </View>
  );
}
