import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { ProfilePanel } from '@/components/profile-panel';
import { TaskComposer } from '@/components/task-composer';
import { VerifiedBadge } from '@/components/verified-badge';
import type { EnrichedMatch, Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';

type ForgeView = 'applicants' | 'posted' | 'archived';
type SortMode = 'bid' | 'date' | 'rating' | 'experience';

const sortLabels: Record<SortMode, string> = {
  bid: 'Bid',
  date: 'Date',
  rating: 'Rating',
  experience: 'XP',
};

export default function ForgeScreen() {
  const { profile, tasks, matches, likeBack, isDark } = useGigStore();
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
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
        return b.doer.rating - a.doer.rating;
      }

      return b.doer.vouch_count - a.doer.vouch_count;
    });
  }, [matches, profile.id, sortMode]);

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

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
            <Pressable
              accessibilityRole="button"
              onPress={() => setProfileOpen(true)}
              className={`h-11 w-11 items-center justify-center rounded-full border ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
              <Ionicons name="ellipsis-horizontal" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
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
          <ViewButton title="Hustlers" count={applicantMatches.length} active={activeView === 'applicants'} onPress={() => setActiveView('applicants')} />
          <ViewButton title="Posted" count={openTasks.length} active={activeView === 'posted'} onPress={() => setActiveView('posted')} />
          <ViewButton title="Archived" count={archivedTasks.length} active={activeView === 'archived'} onPress={() => setActiveView('archived')} />
        </View>

        {activeView === 'applicants' && (
          <View>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  onPress={() => setSortMode(mode)}
                  className={`min-h-10 rounded-full border px-4 ${
                    sortMode === mode ? 'border-violet bg-violet' : isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'
                  }`}>
                  <Text className={`py-2 text-sm font-black ${sortMode === mode || isDark ? 'text-white' : 'text-zinc-950'}`}>
                    {sortLabels[mode]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {applicantMatches.length === 0 ? (
              <EmptyState copy="Counter bids from hustlers land here after they swipe right on your gigs." />
            ) : (
              applicantMatches.map((match) => (
                <ApplicantCard key={match.id} match={match} onPick={() => void likeBack(match.id)} />
              ))
            )}
          </View>
        )}

        {activeView === 'posted' && (
          <View>
            {openTasks.length === 0 ? (
              <EmptyState copy="Open gigs you create will appear here." />
            ) : (
              openTasks.map((task) => <PostedGigCard key={task.id} task={task} />)
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
            <TaskComposer onCreated={() => setComposerOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`max-h-[88%] rounded-t-[34px] border px-5 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
              <ProfilePanel />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BstPurchaseSheet visible={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
    </SafeAreaView>
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

function ApplicantCard({ match, onPick }: { match: EnrichedMatch; onPick: () => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const cardClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const content = (
    <View className={`mb-4 rounded-[30px] border p-5 ${cardClass}`}>
      <View className="mb-4 flex-row items-center gap-3">
        <Avatar profile={match.doer} size={58} />
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className={`text-lg font-black ${titleClass}`} numberOfLines={1}>{match.doer.username}</Text>
            <VerifiedBadge verified={match.doer.is_verified} compact />
          </View>
          <Text className={`text-sm ${mutedClass}`} numberOfLines={1}>{match.task.title}</Text>
        </View>
        <Ionicons name={match.status === 'matched' ? 'checkmark-circle' : 'person-add'} size={22} color="#10B981" />
      </View>

      <View className="mb-4 flex-row gap-3">
        <Metric icon="cash" label="Counter" value={`$${match.counter_bid}`} />
        <Metric icon="calendar" label="Available" value={match.availability_window || 'Flexible'} />
      </View>
      <View className="mb-4 flex-row gap-3">
        <Metric icon="star" label="Rating" value={match.doer.rating.toFixed(2)} />
        <Metric icon="medal" label="Sweat Wins" value={match.doer.vouch_count.toString()} />
      </View>

      <View className={`mb-4 rounded-[24px] p-4 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
        <Text className="mb-1 text-xs font-bold text-orange-400">Note</Text>
        <Text className={`text-base leading-6 ${titleClass}`}>{match.bid_note}</Text>
      </View>

      {match.status === 'pending' ? (
        <PrimaryButton label="Pick Hustler" icon="heart" tone="emerald" onPress={onPick} />
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

function PostedGigCard({ task, archived = false }: { task: Task; archived?: boolean }) {
  const { matches, isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const candidateCount = matches.filter((match) => match.task.id === task.id && match.status !== 'completed').length;

  return (
    <View className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`text-xl font-black ${titleClass}`} numberOfLines={2}>{task.title}</Text>
          <Text className={`mt-1 text-sm ${mutedClass}`}>{task.category} - {task.location_label}</Text>
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
    </View>
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
