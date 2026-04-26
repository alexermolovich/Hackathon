import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, useFocusEffect } from 'expo-router';
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
import { TaskComposer } from '@/components/task-composer';
import { VerifiedBadge } from '@/components/verified-badge';
import type { EnrichedMatch, Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { getTaskCategoryLabels, getUnreadMessageCount, hasUnseenCounterBid } from '@/lib/gig-utils';
import { formatVisibleRating, visibleRatingValue } from '@/lib/rating-utils';
import { resolveImageSource } from '@/lib/repo-images';
import { gigHref } from '@/lib/routes';

type ForgeView = 'applicants' | 'posted' | 'archived';
type SortMode = 'bid' | 'date' | 'rating' | 'experience';

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

export default function ForgeScreen() {
  const { profile, tasks, matches, messages, likeBack, completeMatch, rateMatch, markCounterBidsSeen, isDark } = useGigStore();
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeView, setActiveView] = useState<ForgeView>('applicants');
  const [sortMode, setSortMode] = useState<SortMode>('bid');

  const myTasks = tasks.filter((task) => task.poster_id === profile.id);
  const archivedTasks = myTasks.filter((task) => task.status === 'archived');
  const openTasks = myTasks.filter((task) => task.status === 'open');
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
  const completedApplicantMatches = useMemo(
    () => matches.filter((match) => match.task.poster_id === profile.id && match.status === 'completed'),
    [matches, profile.id],
  );
  const unseenCounterBidIds = useMemo(
    () => applicantMatches.filter((match) => hasUnseenCounterBid(match, profile.id)).map((match) => match.id),
    [applicantMatches, profile.id],
  );

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

  function pickHustler(matchId: string) {
    void likeBack(matchId);
    router.push({ pathname: '/chat/[matchId]', params: { matchId } });
  }

  async function handleRate(matchId: string, rating: number) {
    const ok = await rateMatch(matchId, rating);

    if (!ok) {
      Alert.alert('Rating not saved', 'Only completed gigs can be rated.');
    }
  }

  function confirmPick(match: EnrichedMatch) {
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
    Alert.alert(
      'Complete this gig?',
      `Confirm ${match.doer.username} finished "${match.task.title}" for $${match.counter_bid}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => void completeMatch(match.id) },
      ],
    );
  }

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
            <Text className="text-sm font-semibold text-orange-400">Gig starter</Text>
            <Text className={`text-3xl font-black ${titleClass}`}>Forge</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <CreditBadge credits={profile.credits} onPress={() => setPurchaseOpen(true)} />
            <ProfileTrigger onPress={() => setProfileOpen(true)} />
          </View>
        </View>

        <View className="mb-5 items-center justify-center">
          <Pressable
            accessibilityRole="button"
            onPress={() => setComposerOpen(true)}
            className="h-20 w-20 items-center justify-center rounded-full bg-orange-500">
            <Ionicons name="add" size={40} color="#FFFFFF" />
          </Pressable>
          <Text className={`mt-3 text-sm font-bold ${mutedClass}`}>Create a gig</Text>
        </View>

        <View className={`mb-5 flex-row rounded-[26px] border p-1 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
          <ViewButton title="Hustlers" count={applicantMatches.length + completedApplicantMatches.length} active={activeView === 'applicants'} onPress={() => setActiveView('applicants')} />
          <ViewButton title="Posted" count={openTasks.length} active={activeView === 'posted'} onPress={() => setActiveView('posted')} />
          <ViewButton title="Archived" count={archivedTasks.length} active={activeView === 'archived'} onPress={() => setActiveView('archived')} />
        </View>

        {activeView === 'applicants' && (
          <View>
            <SortControl active={sortMode} onChange={setSortMode} />

            {applicantMatches.length === 0 && completedApplicantMatches.length === 0 ? (
              <EmptyState copy="Counter bids from hustlers land here after they swipe right on your gigs." />
            ) : (
              applicantMatches.map((match) => (
                <ApplicantCard
                  key={match.id}
                  match={match}
                  newCounterBid={hasUnseenCounterBid(match, profile.id)}
                  unreadMessageCount={getUnreadMessageCount(match, messages, profile.id)}
                  onComplete={() => confirmComplete(match)}
                  onPick={() => confirmPick(match)}
                />
              ))
            )}

            {completedApplicantMatches.length > 0 ? (
              <View className="mt-2">
                <SectionLabel title="Completed hustlers" count={completedApplicantMatches.length} />
                {completedApplicantMatches.map((match) => (
                  <CompletedApplicantCard
                    key={match.id}
                    match={match}
                    onRate={(rating) => void handleRate(match.id, rating)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}

        {activeView === 'posted' && (
          <View>
            {openTasks.length === 0 ? (
              <EmptyState copy="Open gigs you create will appear here." />
            ) : (
              openTasks.map((task) => <PostedGigCard key={task.id} task={task} onPress={() => setEditingTask(task)} />)
            )}
          </View>
        )}

        {activeView === 'archived' && (
          <View>
            {archivedTasks.length === 0 ? (
              <EmptyState copy="Finished or archived gigs will appear here." />
            ) : (
              archivedTasks.map((task) => <PostedGigCard key={task.id} task={task} archived />)
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

      <BstPurchaseSheet visible={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
    </SafeAreaView>
  );
}

function SortControl({ active, onChange }: { active: SortMode; onChange: (mode: SortMode) => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <View className={`mb-4 rounded-[26px] border p-4 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className={`text-base font-black ${titleClass}`}>Sort applicants</Text>
          <Text className={`text-xs font-semibold ${mutedClass}`}>Choose how hustlers are ranked</Text>
        </View>
        <Ionicons name="swap-vertical" size={20} color="#8B5CF6" />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {sortOptions.map((option) => {
          const selected = active === option.mode;

          return (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              onPress={() => onChange(option.mode)}
              className={`min-h-16 flex-1 basis-[47%] rounded-[20px] border p-3 ${
                selected
                  ? 'border-violet bg-violet'
                  : isDark
                    ? 'border-white/10 bg-white/10'
                    : 'border-zinc-200 bg-zinc-100'
              }`}>
              <View className="mb-1 flex-row items-center gap-2">
                <Ionicons name={option.icon} size={16} color={selected ? '#FFFFFF' : '#8B5CF6'} />
                <Text className={`text-sm font-black ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}>
                  {option.label}
                </Text>
              </View>
              <Text className={`text-xs font-semibold ${selected ? 'text-white/80' : mutedClass}`}>{option.caption}</Text>
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
  onComplete,
  onPick,
  unreadMessageCount,
}: {
  match: EnrichedMatch;
  newCounterBid: boolean;
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

  if (match.status === 'matched') {
    return (
      <Link href={{ pathname: '/chat/[matchId]', params: { matchId: match.id } }} asChild>
        <Pressable accessibilityRole="button">{content}</Pressable>
      </Link>
    );
  }

  return content;
}

function CompletedApplicantCard({ match, onRate }: { match: EnrichedMatch; onRate: (rating: number) => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <View className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'}`}>
      <View className="mb-4 flex-row items-center gap-3">
        <Avatar profile={match.doer} size={58} />
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className={`text-lg font-black ${titleClass}`} numberOfLines={1}>{match.doer.username}</Text>
            <VerifiedBadge verified={match.doer.is_verified} compact />
          </View>
          <Text className={`text-sm ${mutedClass}`} numberOfLines={1}>Finished: {match.task.title}</Text>
        </View>
        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
      </View>

      <View className="mb-4 flex-row gap-3">
        <Metric icon="cash" label="Paid" value={`$${match.counter_bid}`} />
        <Metric icon="medal" label="Completed" value={match.doer.vouch_count.toString()} />
      </View>

      <StarRating
        label={match.doer_rating_by_poster ? `You rated ${match.doer.username} ${match.doer_rating_by_poster}/5` : 'Rate hustler'}
        value={match.doer_rating_by_poster}
        onRate={onRate}
      />
    </View>
  );
}

function SectionLabel({ title, count }: { title: string; count: number }) {
  const { isDark } = useGigStore();

  return (
    <View className="mb-3 mt-2 flex-row items-center justify-between">
      <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{title}</Text>
      <Text className={`rounded-full px-3 py-1 text-xs font-bold ${isDark ? 'bg-white/10 text-zinc-300' : 'bg-white text-zinc-700'}`}>{count}</Text>
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
