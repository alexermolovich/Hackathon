import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
import { matchesSearchQuery } from '@/lib/search-utils';
import { APP_NAME, CHAT_UNLOCK_COST_BSTS, CURRENCY_NAME } from '@/lib/sidehustle-config';

type HustlesSection = 'ready' | 'pending' | 'finished';

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
  const [purchaseReason, setPurchaseReason] = useState<string | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionTouched, setSectionTouched] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<HustlesSection, boolean>>({
    ready: true,
    pending: false,
    finished: false,
  });

  const readyHustles = matches.filter((match) => match.doer_id === profile.id && match.status === 'matched');
  const pendingBids = matches.filter((match) => match.doer_id === profile.id && match.status === 'pending');
  const completed = matches.filter((match) => match.doer_id === profile.id && match.status === 'completed');
  const filteredReadyHustles = useMemo(
    () => readyHustles.filter((match) => hustleMatchesQuery(match, searchQuery)),
    [readyHustles, searchQuery],
  );
  const filteredPendingBids = useMemo(
    () => pendingBids.filter((match) => hustleMatchesQuery(match, searchQuery)),
    [pendingBids, searchQuery],
  );
  const filteredCompleted = useMemo(
    () => completed.filter((match) => hustleMatchesQuery(match, searchQuery)),
    [completed, searchQuery],
  );
  const unseenAcceptedIds = useMemo(
    () => readyHustles.filter((match) => hasUnseenAcceptedOffer(match, profile.id)).map((match) => match.id),
    [readyHustles, profile.id],
  );

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';

  async function handleUnlock(matchId: string) {
    const ok = await unlockChat(matchId);

    if (!ok) {
      setPurchaseReason(
        `You don't have enough ${CURRENCY_NAME} to unlock this hustle. Unlocking a hustle costs ${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME}.`,
      );
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

  function toggleSection(section: HustlesSection) {
    setSectionTouched(true);
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function updateSearchQuery(value: string) {
    setSearchQuery(value);

    if (!value.trim()) {
      setSectionTouched(true);
      setExpandedSections({ ready: false, pending: false, finished: false });
    }
  }

  useEffect(() => {
    if (searchQuery.trim()) {
      const hasAnyMatch = filteredReadyHustles.length > 0 || filteredPendingBids.length > 0 || filteredCompleted.length > 0;

      setExpandedSections({
        ready: filteredReadyHustles.length > 0 || !hasAnyMatch,
        pending: filteredPendingBids.length > 0,
        finished: filteredCompleted.length > 0,
      });
      return;
    }

    if (sectionTouched) {
      return;
    }

    setExpandedSections({
      ready: readyHustles.length > 0 || pendingBids.length === 0,
      pending: readyHustles.length === 0 && pendingBids.length > 0,
      finished: false,
    });
  }, [
    filteredCompleted.length,
    filteredPendingBids.length,
    filteredReadyHustles.length,
    pendingBids.length,
    readyHustles.length,
    searchQuery,
    sectionTouched,
  ]);

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
            <CreditBadge
              credits={profile.credits}
              onPress={() => {
                setPurchaseReason(undefined);
                setPurchaseOpen(true);
              }}
            />
            <ProfileTrigger onPress={() => setProfileOpen(true)} />
          </View>
        </View>

        <View className="mb-4">
          <SearchField
            onChangeText={updateSearchQuery}
            placeholder="Search hustles, gigs, names, location"
            value={searchQuery}
          />
        </View>

        <CollapsibleSection
          count={filteredReadyHustles.length}
          expanded={expandedSections.ready}
          icon="lock-open"
          onToggle={() => toggleSection('ready')}
          title="Ready to unlock">
          {filteredReadyHustles.length === 0 ? (
            <EmptyState copy={searchQuery.trim() ? 'No matching ready hustles found.' : 'When a Gigachad picks your counter bid, the hustle lands here.'} />
          ) : (
            filteredReadyHustles.map((match) => (
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
        </CollapsibleSection>

        <CollapsibleSection
          count={filteredPendingBids.length}
          expanded={expandedSections.pending}
          icon="time"
          onToggle={() => toggleSection('pending')}
          title="Pending bids">
          {filteredPendingBids.length === 0 ? (
            <EmptyState copy={searchQuery.trim() ? 'No matching pending bids found.' : 'Your right-swipe bids wait here until the Gigachad picks you.'} />
          ) : (
            filteredPendingBids.map((match) => <PendingBid key={match.id} match={match} />)
          )}
        </CollapsibleSection>

        <CollapsibleSection
          count={filteredCompleted.length}
          expanded={expandedSections.finished}
          icon="medal"
          onToggle={() => toggleSection('finished')}
          title="Finished hustles">
          {filteredCompleted.length === 0 ? (
            <EmptyState copy={searchQuery.trim() ? 'No matching finished hustles found.' : 'Completed gigs become Hustles Completed on your profile.'} />
          ) : (
            filteredCompleted.map((match) => (
              <CompletedHustleCard key={match.id} match={match} onRate={(rating) => void handleRate(match.id, rating)} />
            ))
          )}
        </CollapsibleSection>
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
        reason={purchaseReason}
        onClose={() => setPurchaseOpen(false)}
      />
    </SafeAreaView>
  );
}

function CollapsibleSection({
  children,
  count,
  expanded,
  icon,
  onToggle,
  title,
}: {
  children: ReactNode;
  count: number;
  expanded: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onToggle: () => void;
  title: string;
}) {
  const { isDark } = useGigStore();

  return (
    <View className="mb-3">
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        className={`min-h-12 flex-row items-center justify-between rounded-[20px] border px-4 ${
          isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'
        }`}>
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon} size={17} color="#A78BFA" />
          <Text className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{title}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className={`rounded-full px-2.5 py-1 text-xs font-bold ${isDark ? 'bg-white/10 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>
            {count}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={isDark ? '#FFFFFF' : '#18181B'} />
        </View>
      </Pressable>
      {expanded ? <View className="pt-3">{children}</View> : null}
    </View>
  );
}

function SearchField({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { isDark } = useGigStore();

  return (
    <View className={`min-h-11 flex-row items-center gap-2 rounded-[20px] border px-3 ${
      isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'
    }`}>
      <Ionicons name="search" size={17} color="#8B5CF6" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#71717A"
        className={`min-w-0 flex-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-950'}`}
      />
      {value.trim() ? (
        <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={17} color="#71717A" />
        </Pressable>
      ) : null}
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
    <View className={`mb-3 rounded-[24px] border p-4 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <View className="flex-row gap-3">
        <View className={`h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[18px] ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
          {taskImageSource ? (
            <Image source={taskImageSource} style={{ height: 72, width: 72 }} contentFit="cover" />
          ) : (
            <Ionicons name="briefcase" size={26} color="#A78BFA" />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className={`flex-1 text-base font-black ${titleClass}`} numberOfLines={1}>
              {match.task.title}
            </Text>
            <Ionicons name={reveal ? 'chatbubble-ellipses' : 'lock-closed'} size={17} color="#A78BFA" />
          </View>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Text className={`text-xs font-semibold ${mutedClass}`} numberOfLines={1}>
              {reveal ? match.poster.username : 'Gigachad hidden'}
            </Text>
            {reveal && <VerifiedBadge verified={match.poster.is_verified} compact />}
          </View>
          <Text className={`mt-1 text-xs ${mutedClass}`} numberOfLines={1}>
            {categoriesText} - {match.task.location_label}
          </Text>
          <Text className={`mt-1 text-xs ${mutedClass}`} numberOfLines={1}>
            {match.task.date_window || 'Flexible'} - Your bid ${match.counter_bid}
          </Text>
        </View>
        <View className="items-end gap-1">
          {newAcceptance ? <NotificationBadge label="New" /> : null}
          {unreadMessageCount > 0 ? <NotificationBadge label={String(unreadMessageCount)} /> : null}
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <Chip icon="cash" label={`Budget $${match.task.budget}`} />
        <Chip icon="pricetag" label={categoriesText} />
      </View>
      <Text className={`mt-2 text-xs leading-5 ${mutedClass}`} numberOfLines={1}>{match.bid_note}</Text>

      {reveal ? (
        <View className="mt-3 flex-row gap-2">
          <Link href={{ pathname: '/chat/[matchId]', params: { matchId: match.id } }} asChild>
            <Pressable accessibilityRole="button" className="min-h-10 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-violet px-4">
              <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Chat</Text>
            </Pressable>
          </Link>
          <PrimaryButton
            label={completionRequested ? 'Waiting' : 'Complete'}
            icon={completionRequested ? 'time' : 'checkmark'}
            tone="ghost"
            disabled={completionRequested}
            onPress={onComplete}
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <View className="mt-3">
          <PrimaryButton
            label={`Unlock (${CHAT_UNLOCK_COST_BSTS} ${CURRENCY_NAME})`}
            icon="flame"
            onPress={onUnlock}
          />
        </View>
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
    <View className={`mb-2 rounded-[18px] border p-3 ${isDark ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'}`}>
      <View className="mb-2 flex-row items-center gap-2.5">
        {reveal ? <Avatar profile={match.poster} size={36} /> : <HiddenAvatar poster={match.poster} size={36} />}
        <View className="flex-1">
          <Text className={`text-sm font-black ${titleClass}`} numberOfLines={1}>
            {match.task.title}
          </Text>
          <Text className={`text-xs ${mutedClass}`} numberOfLines={1}>
            {reveal ? `Completed for Gigachad ${match.poster.username}` : 'Hustle completed'}
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={24} color="#34D399" />
      </View>

      <StarRating
        compact
        label={match.poster_rating_by_doer ? `You rated the Gigachad ${match.poster_rating_by_doer}/5` : 'Rate Gigachad'}
        value={match.poster_rating_by_doer}
        onRate={onRate}
      />

      <Link href={gigHref(match.task.id)} asChild>
        <Pressable accessibilityRole="button" className={`mt-2 min-h-9 flex-row items-center justify-center gap-2 rounded-full border px-3 ${isDark ? 'border-white/10 bg-white/10' : 'border-emerald-200 bg-white'}`}>
          <Ionicons name="briefcase" size={16} color={isDark ? '#FFFFFF' : '#065F46'} />
          <Text className={`text-xs font-bold ${isDark ? 'text-white' : 'text-emerald-900'}`}>Open Gig</Text>
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
    <View className={`mb-2 rounded-[20px] border p-3 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className={`flex-1 text-base font-black ${titleClass}`} numberOfLines={1}>{match.task.title}</Text>
        <Text className="rounded-full bg-violet/20 px-3 py-1 text-xs font-bold text-violet-300">${match.counter_bid}</Text>
      </View>
      <Text className={`mb-1 text-xs ${mutedClass}`}>{match.availability_window || 'Flexible availability'}</Text>
      <Text className={`text-xs leading-5 ${mutedClass}`} numberOfLines={1}>{match.bid_note}</Text>
    </View>
  );
}

function HiddenAvatar({ poster, size = 56 }: { poster: Profile; size?: number }) {
  const avatarSource = resolveImageSource(poster.avatar_url);

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/25"
      style={{ height: size, width: size }}>
      {avatarSource ? (
        <>
          <Image source={avatarSource} style={{ height: size, width: size }} contentFit="cover" />
          <BlurView intensity={30} tint="dark" className="absolute inset-0" />
        </>
      ) : (
        <Ionicons name="person" size={Math.max(20, size * 0.42)} color="#C4B5FD" />
      )}
    </View>
  );
}

function Chip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1.5 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Ionicons name={icon} size={14} color="#8B5CF6" />
      <Text className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function hustleMatchesQuery(match: EnrichedMatch, query: string) {
  return matchesSearchQuery(query, [
    match.poster.username,
    match.poster.bio,
    match.task.title,
    match.task.description,
    match.task.location_label,
    match.task.date_window,
    getTaskCategoryLabels(match.task),
    match.bid_note,
    match.availability_window,
    match.counter_bid,
    match.task.budget,
    match.status,
    match.is_unlocked ? 'unlocked chat open' : 'locked',
  ]);
}

function EmptyState({ copy }: { copy: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`mb-3 rounded-[26px] border border-dashed p-5 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-300 bg-white'}`}>
      <Text className={`text-sm leading-5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{copy}</Text>
    </View>
  );
}
