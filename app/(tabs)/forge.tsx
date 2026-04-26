import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { ProfilePanel } from '@/components/profile-panel';
import { ProfileTrigger } from '@/components/profile-trigger';
import { SelfieCheckGate } from '@/components/selfie-check-gate';
import { TaskComposer } from '@/components/task-composer';
import { VerifiedBadge } from '@/components/verified-badge';
import type { EnrichedMatch, Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { getTaskCategoryLabels, getUnreadMessageCount, hasUnseenCounterBid } from '@/lib/gig-utils';
import { formatVisibleRating, visibleRatingValue } from '@/lib/rating-utils';
import { resolveImageSource } from '@/lib/repo-images';
import { gigHref } from '@/lib/routes';
import { matchesSearchQuery } from '@/lib/search-utils';
import { APP_NAME, CURRENCY_NAME, SEE_MORE_BIDDERS_COST_BSTS } from '@/lib/sidehustle-config';

type ForgeView = 'applicants' | 'posted' | 'archived';
type SortMode = 'bid' | 'date' | 'rating' | 'experience';
type TaskSortMode = 'newest' | 'budget' | 'boost' | 'bids';

const sortOptions: {
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  mode: SortMode;
}[] = [
  { caption: 'Lowest counter first', icon: 'cash', label: 'Price', mode: 'bid' },
  { caption: 'Best availability', icon: 'calendar', label: 'Date', mode: 'date' },
  { caption: 'Highest rated', icon: 'star', label: 'Rating', mode: 'rating' },
  { caption: 'Most completed', icon: 'medal', label: 'Experience', mode: 'experience' },
];

const taskSortOptions: {
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  mode: TaskSortMode;
}[] = [
  { caption: 'Newest first', icon: 'time', label: 'New', mode: 'newest' },
  { caption: 'Highest budget', icon: 'cash', label: 'Budget', mode: 'budget' },
  { caption: 'Boosted first', icon: 'flame', label: 'Boost', mode: 'boost' },
  { caption: 'Most bids', icon: 'people', label: 'Bids', mode: 'bids' },
];

export default function ForgeScreen() {
  const {
    profile,
    tasks,
    matches,
    messages,
    likeBack,
    completeMatch,
    unlockAllBidders,
    markCounterBidsSeen,
    isDark,
  } = useGigStore();
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseReason, setPurchaseReason] = useState<string | undefined>();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeView, setActiveView] = useState<ForgeView>('applicants');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('bid');
  const [taskSortMode, setTaskSortMode] = useState<TaskSortMode>('newest');
  const [verifiedHustlersOnly, setVerifiedHustlersOnly] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);

  const myTasks = tasks.filter((task) => task.poster_id === profile.id);
  const archivedTasks = myTasks.filter((task) => task.status === 'archived');
  const openTasks = myTasks.filter((task) => task.status === 'open');
  const taskBidCounts = useMemo(() => {
    const counts = new Map<string, number>();

    matches.forEach((match) => {
      if (match.task.poster_id === profile.id && match.status !== 'completed') {
        counts.set(match.task.id, (counts.get(match.task.id) ?? 0) + 1);
      }
    });

    return counts;
  }, [matches, profile.id]);
  const sortedOpenTasks = useMemo(
    () => sortForgeTasks(openTasks, taskSortMode, taskBidCounts),
    [openTasks, taskBidCounts, taskSortMode],
  );
  const sortedArchivedTasks = useMemo(
    () => sortForgeTasks(archivedTasks, taskSortMode, taskBidCounts),
    [archivedTasks, taskBidCounts, taskSortMode],
  );
  const applicantMatches = useMemo(() => {
    const mine = matches.filter((match) => match.task.poster_id === profile.id && match.status !== 'completed');

    return [...mine].sort((a, b) => {
      if (sortMode === 'bid') {
        return a.counter_bid - b.counter_bid;
      }

      if (sortMode === 'date') {
        return a.availability_window.localeCompare(b.availability_window);
      }

      if (sortMode === 'rating') {
        return visibleRatingValue(b.doer, 'doer') - visibleRatingValue(a.doer, 'doer');
      }

      return b.doer.vouch_count - a.doer.vouch_count;
    });
  }, [matches, profile.id, sortMode]);
  const filteredApplicantMatches = useMemo(
    () =>
      applicantMatches.filter(
        (match) => applicantMatchesQuery(match, searchQuery) && (!verifiedHustlersOnly || match.doer.is_verified),
      ),
    [applicantMatches, searchQuery, verifiedHustlersOnly],
  );
  const filteredOpenTasks = useMemo(
    () => sortedOpenTasks.filter((task) => taskMatchesQuery(task, searchQuery)),
    [sortedOpenTasks, searchQuery],
  );
  const filteredArchivedTasks = useMemo(
    () => sortedArchivedTasks.filter((task) => taskMatchesQuery(task, searchQuery)),
    [sortedArchivedTasks, searchQuery],
  );
  const biddersUnlocked = Boolean(profile.bidder_access_unlocked_at);
  const visibleApplicantMatches = useMemo(
    () => (biddersUnlocked ? filteredApplicantMatches : filteredApplicantMatches.slice(0, 2)),
    [biddersUnlocked, filteredApplicantMatches],
  );
  const hiddenBidderCount = Math.max(0, filteredApplicantMatches.length - visibleApplicantMatches.length);
  const unseenCounterBidIds = useMemo(
    () => visibleApplicantMatches.filter((match) => hasUnseenCounterBid(match, profile.id)).map((match) => match.id),
    [profile.id, visibleApplicantMatches],
  );

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';

  function requireVerified() {
    if (profile.is_verified) {
      return true;
    }

    setVerificationOpen(true);
    return false;
  }

  function pickHustler(matchId: string) {
    if (!requireVerified()) {
      return;
    }

    void likeBack(matchId);
    router.push({ pathname: '/chat/[matchId]', params: { matchId } });
  }

  function confirmPick(match: EnrichedMatch) {
    if (!requireVerified()) {
      return;
    }

    Alert.alert(
      'Select this hustler?',
      `Are you sure you want to select ${match.doer.username} for "${match.task.title}" at $${match.counter_bid}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => void pickHustler(match.id) },
      ],
    );
  }

  function confirmComplete(match: EnrichedMatch) {
    if (!requireVerified()) {
      return;
    }

    Alert.alert(
      'Complete this gig?',
      `Confirm ${match.doer.username} finished "${match.task.title}" for $${match.counter_bid}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => void completeMatch(match.id) },
      ],
    );
  }

  async function handleUnlockBidders() {
    if (!requireVerified()) {
      return;
    }

    const ok = await unlockAllBidders();

    if (!ok) {
      setPurchaseReason(
        `You don't have enough ${CURRENCY_NAME} to see all bidders. Seeing all bidders costs ${SEE_MORE_BIDDERS_COST_BSTS} ${CURRENCY_NAME}.`,
      );
      setPurchaseOpen(true);
    }
  }

  function confirmUnlockBidders() {
    if (!requireVerified()) {
      return;
    }

    Alert.alert(
      'See all bidders?',
      `Spend ${SEE_MORE_BIDDERS_COST_BSTS} ${CURRENCY_NAME} to unlock every bidder for your gigs.`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => void handleUnlockBidders() },
      ],
    );
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const activeCount =
      activeView === 'applicants'
        ? filteredApplicantMatches.length
        : activeView === 'posted'
          ? filteredOpenTasks.length
          : filteredArchivedTasks.length;

    if (activeCount > 0) {
      return;
    }

    if (filteredApplicantMatches.length > 0) {
      setActiveView('applicants');
      return;
    }

    if (filteredOpenTasks.length > 0) {
      setActiveView('posted');
      return;
    }

    if (filteredArchivedTasks.length > 0) {
      setActiveView('archived');
    }
  }, [
    activeView,
    filteredApplicantMatches.length,
    filteredArchivedTasks.length,
    filteredOpenTasks.length,
    searchQuery,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (activeView === 'applicants' && unseenCounterBidIds.length > 0) {
        void markCounterBidsSeen(unseenCounterBidIds);
      }
    }, [activeView, markCounterBidsSeen, unseenCounterBidIds]),
  );

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold text-orange-400">{APP_NAME}</Text>
            <Text className={`text-2xl font-black ${titleClass}`}>GigHub</Text>
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

        <View className="mb-4 flex-row gap-2">
          <SearchField
            onChangeText={setSearchQuery}
            placeholder="Search gigs, hustlers, location"
            value={searchQuery}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (requireVerified()) {
                setComposerOpen(true);
              }
            }}
            className="min-h-11 flex-row items-center justify-center gap-1.5 rounded-[20px] bg-orange-500 px-4">
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text className="text-xs font-black text-white">Create</Text>
          </Pressable>
        </View>

        <View className={`mb-5 flex-row rounded-[26px] border p-1 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
          <ViewButton title="Hustlers" count={filteredApplicantMatches.length} active={activeView === 'applicants'} onPress={() => setActiveView('applicants')} />
          <ViewButton title="Posted" count={filteredOpenTasks.length} active={activeView === 'posted'} onPress={() => setActiveView('posted')} />
          <ViewButton title="Archived" count={filteredArchivedTasks.length} active={activeView === 'archived'} onPress={() => setActiveView('archived')} />
        </View>

        {activeView === 'applicants' && (
          <View>
            <SortControl
              active={sortMode}
              onChange={setSortMode}
              onVerifiedOnlyChange={setVerifiedHustlersOnly}
              verifiedOnly={verifiedHustlersOnly}
            />

            {filteredApplicantMatches.length === 0 ? (
              <EmptyState
                copy={
                  verifiedHustlersOnly
                    ? 'No verified hustlers match this view yet.'
                    : searchQuery.trim()
                      ? 'No matching hustlers or gigs found.'
                      : 'Counter bids from hustlers land here after they swipe right on your gigs.'
                }
              />
            ) : (
              <>
                {visibleApplicantMatches.map((match) => (
                  <ApplicantCard
                    key={match.id}
                    match={match}
                    newCounterBid={hasUnseenCounterBid(match, profile.id)}
                    unreadMessageCount={getUnreadMessageCount(match, messages, profile.id)}
                    onChat={() => {
                      if (requireVerified()) {
                        router.push({ pathname: '/chat/[matchId]', params: { matchId: match.id } });
                      }
                    }}
                    onComplete={() => confirmComplete(match)}
                    onPick={() => confirmPick(match)}
                  />
                ))}
                {hiddenBidderCount > 0 ? (
                  <SeeMoreBiddersCard count={hiddenBidderCount} onPress={confirmUnlockBidders} />
                ) : null}
              </>
            )}
          </View>
        )}

        {activeView === 'posted' && (
          <View>
            <TaskSortControl
              active={taskSortMode}
              onChange={setTaskSortMode}
              onVerify={() => setVerificationOpen(true)}
              verified={profile.is_verified}
            />
            {filteredOpenTasks.length === 0 ? (
              <EmptyState copy={searchQuery.trim() ? 'No matching posted gigs found.' : 'Open gigs you create will appear here.'} />
            ) : (
              filteredOpenTasks.map((task) => (
                <PostedGigCard
                  key={task.id}
                  task={task}
                  onPress={() => {
                    if (requireVerified()) {
                      setEditingTask(task);
                    }
                  }}
                />
              ))
            )}
          </View>
        )}

        {activeView === 'archived' && (
          <View>
            <TaskSortControl
              active={taskSortMode}
              onChange={setTaskSortMode}
              onVerify={() => setVerificationOpen(true)}
              verified={profile.is_verified}
            />
            {filteredArchivedTasks.length === 0 ? (
              <EmptyState copy={searchQuery.trim() ? 'No matching archived gigs found.' : 'Finished or archived gigs will appear here.'} />
            ) : (
              filteredArchivedTasks.map((task) => <PostedGigCard key={task.id} task={task} archived />)
            )}
          </View>
        )}
      </ScrollView>

      <Modal transparent animationType="slide" visible={composerOpen} onRequestClose={() => setComposerOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`max-h-[90%] rounded-t-[34px] border px-5 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <TaskComposer onClose={() => setComposerOpen(false)} onCreated={() => setComposerOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={Boolean(editingTask)} onRequestClose={() => setEditingTask(null)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`max-h-[90%] rounded-t-[34px] border px-5 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <TaskComposer onClose={() => setEditingTask(null)} task={editingTask} onSaved={() => setEditingTask(null)} />
          </View>
        </View>
      </Modal>

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
      <SelfieCheckGate visible={verificationOpen} onClose={() => setVerificationOpen(false)} />
    </SafeAreaView>
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
    <View className={`min-h-11 flex-1 flex-row items-center gap-2 rounded-[20px] border px-3 ${
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

function SortControl({
  active,
  onChange,
  onVerifiedOnlyChange,
  verifiedOnly,
}: {
  active: SortMode;
  onChange: (mode: SortMode) => void;
  onVerifiedOnlyChange: (value: boolean) => void;
  verifiedOnly: boolean;
}) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const activeOption = sortOptions.find((option) => option.mode === active);
  const filterThumbLeft = verifiedOnly ? '50%' : '0%';

  return (
    <View className="mb-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className={`text-sm font-black ${titleClass}`}>Sort Hustlers</Text>
        <Text className={`text-xs font-semibold ${mutedClass}`}>{activeOption?.caption}</Text>
      </View>
      <View className={`flex-row rounded-[24px] border p-1 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
        {sortOptions.map((option) => {
          const selected = active === option.mode;

          return (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              onPress={() => onChange(option.mode)}
              className={`min-h-10 flex-1 items-center justify-center rounded-[20px] ${
                selected
                  ? 'bg-violet'
                  : 'bg-transparent'
              }`}>
              <Ionicons name={option.icon} size={16} color={selected ? '#FFFFFF' : '#8B5CF6'} />
              <Text className={`mt-0.5 text-[10px] font-black ${selected || isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row items-center gap-2">
        <View className={`min-h-10 flex-1 flex-row items-center gap-2 rounded-[20px] border px-3 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
          <Ionicons name="shield-checkmark" size={16} color="#8B5CF6" />
          <Text className={`text-xs font-black ${titleClass}`}>Hustler filter</Text>
        </View>
        <View className={`relative h-10 w-36 flex-row overflow-hidden rounded-[20px] border p-1 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
          <View
            pointerEvents="none"
            className="absolute bottom-1 top-1 rounded-[16px] bg-violet"
            style={{ left: filterThumbLeft as `${number}%`, width: '50%' as `${number}%` }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => onVerifiedOnlyChange(false)}
            className="min-h-8 flex-1 items-center justify-center rounded-[16px]">
            <Text className={`text-[10px] font-black ${!verifiedOnly || isDark ? 'text-white' : 'text-zinc-950'}`}>
              All
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onVerifiedOnlyChange(true)}
            className="min-h-8 flex-1 items-center justify-center rounded-[16px]">
            <Text className={`text-[10px] font-black ${verifiedOnly || isDark ? 'text-white' : 'text-zinc-950'}`}>
              Verified
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function TaskSortControl({
  active,
  onChange,
  onVerify,
  verified,
}: {
  active: TaskSortMode;
  onChange: (mode: TaskSortMode) => void;
  onVerify: () => void;
  verified: boolean;
}) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const activeOption = taskSortOptions.find((option) => option.mode === active);
  const activeIndex = Math.max(0, taskSortOptions.findIndex((option) => option.mode === active));
  const sliderStep = 100 / taskSortOptions.length;
  const sliderThumbLeft = `${activeIndex * sliderStep}%` as `${number}%`;
  const sliderThumbWidth = `${sliderStep}%` as `${number}%`;

  if (!verified) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onVerify}
        className={`mb-3 flex-row items-center gap-3 rounded-[22px] border px-4 py-3 ${
          isDark ? 'border-orange-400/30 bg-orange-500/10' : 'border-orange-200 bg-orange-50'
        }`}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-500">
          <Ionicons name="shield-checkmark" size={19} color="#FFFFFF" />
        </View>
        <View className="flex-1">
          <Text className={`text-sm font-black ${titleClass}`}>Verify to sort gigs</Text>
          <Text className={`text-xs font-semibold ${mutedClass}`} numberOfLines={1}>
            Sort by newest, budget, boost, or bids.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#F97316" />
      </Pressable>
    );
  }

  return (
    <View className="mb-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className={`text-sm font-black ${titleClass}`}>Sort Gigs</Text>
        <Text className={`text-xs font-semibold ${mutedClass}`}>{activeOption?.caption}</Text>
      </View>
      <View className={`relative flex-row overflow-hidden rounded-[24px] border p-1 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
        <View
          pointerEvents="none"
          className="absolute bottom-1 top-1 rounded-[20px] bg-orange-500"
          style={{ left: sliderThumbLeft, width: sliderThumbWidth }}
        />
        {taskSortOptions.map((option) => {
          const selected = active === option.mode;

          return (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              onPress={() => onChange(option.mode)}
              className="min-h-10 flex-1 items-center justify-center rounded-[20px]">
              <Ionicons name={option.icon} size={16} color={selected ? '#FFFFFF' : '#F97316'} />
              <Text
                className={`mt-0.5 text-[10px] font-black ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}
                numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ViewButton({
  title,
  count,
  active,
  onPress,
}: {
  title: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { isDark } = useGigStore();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-12 flex-1 items-center justify-center rounded-[22px] ${active ? 'bg-violet' : 'bg-transparent'}`}>
      <Text className={`text-sm font-black ${active || isDark ? 'text-white' : 'text-zinc-950'}`}>{title}</Text>
      <Text className={`text-xs font-bold ${active || isDark ? 'text-white/80' : 'text-zinc-500'}`}>{count}</Text>
    </Pressable>
  );
}

function ApplicantCard({
  match,
  newCounterBid,
  onChat,
  onComplete,
  onPick,
  unreadMessageCount,
}: {
  match: EnrichedMatch;
  newCounterBid: boolean;
  onChat: () => void;
  onComplete: () => void;
  onPick: () => void;
  unreadMessageCount: number;
}) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const cardClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const completionRequested = Boolean(match.doer_completed_at);
  const content = (
    <View className={`mb-4 rounded-[30px] border p-5 ${cardClass}`}>
      <View className="mb-4 flex-row items-center gap-3">
        <Avatar profile={match.doer} size={58} />
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className={`text-lg font-black ${titleClass}`} numberOfLines={1}>{match.doer.username}</Text>
            <VerifiedBadge verified={match.doer.is_verified} compact />
          </View>
          <Text className={`text-sm ${mutedClass}`} numberOfLines={1}>Ready to do: {match.task.title}</Text>
        </View>
        <View className="items-end gap-2">
          {newCounterBid ? <NotificationBadge label="New" /> : null}
          {unreadMessageCount > 0 ? <NotificationBadge label={String(unreadMessageCount)} /> : null}
          {match.status === 'matched' ? <Ionicons name="checkmark-circle" size={22} color="#10B981" /> : null}
        </View>
      </View>

      <View className="mb-4 flex-row gap-3">
        <Metric icon="cash" label="Counter" value={`$${match.counter_bid}`} />
        <Metric icon="calendar" label="Available" value={match.availability_window || 'Flexible'} />
      </View>
      <View className="mb-4 flex-row gap-3">
        <Metric icon="star" label="Rating" value={formatVisibleRating(match.doer, 'doer')} />
        <Metric icon="medal" label="Hustles Completed" value={match.doer.vouch_count.toString()} />
      </View>

      <View className={`mb-4 rounded-[24px] p-4 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
        <Text className="mb-1 text-xs font-bold text-orange-400">Note</Text>
        <Text className={`text-base leading-6 ${titleClass}`}>{match.bid_note}</Text>
      </View>

      {match.status === 'pending' ? (
        <PrimaryButton label="Pick Hustler" icon="heart" tone="emerald" onPress={onPick} />
      ) : completionRequested ? (
        <View className="gap-3">
          <View className={`rounded-[22px] px-4 py-3 ${isDark ? 'bg-orange-500/15' : 'bg-orange-50'}`}>
            <Text className={`text-sm font-black ${isDark ? 'text-orange-100' : 'text-orange-800'}`}>
              Hustler marked this complete
            </Text>
          </View>
          <PrimaryButton label="Confirm Complete" icon="checkmark-done" tone="emerald" onPress={onComplete} />
        </View>
      ) : (
        <View className={`rounded-[22px] px-4 py-3 ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
          <Text className={`text-sm font-black ${isDark ? 'text-emerald-100' : 'text-emerald-800'}`}>
            {match.is_unlocked ? 'Chat open' : 'Picked - waiting for unlock'}
          </Text>
        </View>
      )}
    </View>
  );

  if (match.status === 'matched' && !completionRequested) {
    return (
      <Pressable accessibilityRole="button" onPress={onChat}>{content}</Pressable>
    );
  }

  return content;
}

function NotificationBadge({ label }: { label: string }) {
  return (
    <View className="min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-1">
      <Text className="text-xs font-black text-white">{label}</Text>
    </View>
  );
}

function SeeMoreBiddersCard({ count, onPress }: { count: number; onPress: () => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <View className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-orange-400/30 bg-orange-500/10' : 'border-orange-200 bg-orange-50'}`}>
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
          <Ionicons name="people" size={22} color="#F97316" />
        </View>
        <View className="flex-1">
          <Text className={`text-lg font-black ${titleClass}`}>More bidders waiting</Text>
          <Text className={`text-sm ${mutedClass}`}>
            {count} more bidder{count === 1 ? '' : 's'} hidden behind the convenience unlock.
          </Text>
        </View>
      </View>
      <PrimaryButton
        label={`See all bidders (${SEE_MORE_BIDDERS_COST_BSTS} ${CURRENCY_NAME})`}
        icon="lock-open"
        onPress={onPress}
      />
    </View>
  );
}

function PostedGigCard({ task, archived = false, onPress }: { task: Task; archived?: boolean; onPress?: () => void }) {
  const { matches, isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const candidateCount = matches.filter((match) => match.task.id === task.id && match.status !== 'completed').length;
  const categoriesText = getTaskCategoryLabels(task).join(', ');
  const taskImageSource = resolveImageSource(task.image_urls[0]);

  const content = (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      {taskImageSource ? (
        <Image source={taskImageSource} style={{ borderRadius: 22, height: 132, marginBottom: 16, width: '100%' }} contentFit="cover" />
      ) : null}
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`text-xl font-black ${titleClass}`} numberOfLines={2}>{task.title}</Text>
          <Text className={`mt-1 text-sm ${mutedClass}`}>{categoriesText} - {task.location_label}</Text>
        </View>
        <View className={`rounded-full px-3 py-2 ${archived ? 'bg-zinc-500/20' : 'bg-violet/20'}`}>
          <Text className={`text-xs font-black ${archived ? mutedClass : 'text-violet-300'}`}>
            {archived ? 'Archived' : `${candidateCount} bids`}
          </Text>
        </View>
      </View>
      <Text className={`mb-4 text-sm leading-5 ${mutedClass}`} numberOfLines={3}>{task.description}</Text>
      <View className="flex-row gap-3">
        <Metric icon="cash" label="Budget" value={`$${task.budget}`} />
        <Metric icon="flame" label="Boost" value={task.is_boosted ? `${task.boost_days}d` : 'Off'} />
      </View>
    </Pressable>
  );

  if (onPress) {
    return content;
  }

  return (
    <Link href={gigHref(task.id)} asChild>
      {content}
    </Link>
  );
}

function applicantMatchesQuery(match: EnrichedMatch, query: string) {
  return matchesSearchQuery(query, [
    match.doer.username,
    match.doer.bio,
    match.doer.skills,
    match.doer.interests,
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
  ]);
}

function taskMatchesQuery(task: Task, query: string) {
  return matchesSearchQuery(query, [
    task.title,
    task.description,
    task.location_label,
    task.date_window,
    getTaskCategoryLabels(task),
    task.required_skills,
    task.budget,
    task.status,
    task.is_boosted ? 'boosted' : 'not boosted',
  ]);
}

function sortForgeTasks(tasks: Task[], mode: TaskSortMode, bidCounts: Map<string, number>) {
  return [...tasks].sort((a, b) => {
    if (mode === 'budget') {
      return b.budget - a.budget;
    }

    if (mode === 'boost') {
      if (a.is_boosted !== b.is_boosted) {
        return a.is_boosted ? -1 : 1;
      }

      return b.boost_days - a.boost_days;
    }

    if (mode === 'bids') {
      return (bidCounts.get(b.id) ?? 0) - (bidCounts.get(a.id) ?? 0);
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { isDark } = useGigStore();

  return (
    <View className={`flex-1 rounded-[22px] px-3 py-3 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <View className="mb-2 flex-row items-center gap-1">
        <Ionicons name={icon} size={15} color={icon === 'flame' ? '#F97316' : '#8B5CF6'} />
        <Text className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
      </View>
      <Text className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={1}>{value}</Text>
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
