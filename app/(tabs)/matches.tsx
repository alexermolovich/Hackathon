import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { MatchRevealCard } from '@/components/match-reveal-card';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import type { EnrichedMatch } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';

export default function MatchesScreen() {
  const {
    profile,
    matches,
    likeBack,
    completeMatch,
    celebratedMatchId,
    clearCelebration,
    isDark,
  } = useGigStore();

  const posterQueue = matches.filter((match) => match.task.poster_id === profile.id && match.status === 'pending');
  const doerMatches = matches.filter((match) => match.doer_id === profile.id);
  const activeMatches = doerMatches.filter((match) => match.status === 'matched');
  const pendingBids = doerMatches.filter((match) => match.status === 'pending');
  const completed = doerMatches.filter((match) => match.status === 'completed');

  const celebratedMatch = matches.find((match) => match.id === celebratedMatchId);
  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
        <View className="mb-6">
          <Text className="text-sm font-semibold text-violet-200">Double opt-in</Text>
          <Text className={`text-3xl font-black ${titleClass}`}>Matches</Text>
        </View>

        <SectionHeader title="Poster review" count={posterQueue.length} icon="people" />
        {posterQueue.length === 0 ? (
          <EmptyState copy="Incoming bids will appear here with vouch score, rating, and verification status." />
        ) : (
          posterQueue.map((match) => (
            <PosterReviewCard
              key={match.id}
              match={match}
              onLikeBack={() => void likeBack(match.id)}
            />
          ))
        )}

        <SectionHeader title="Ready to unlock" count={activeMatches.length} icon="lock-open" />
        {activeMatches.length === 0 ? (
          <EmptyState copy="When posters like you back, the match lands here with chat behind the 5-credit unlock." />
        ) : (
          activeMatches.map((match) => <MatchRow key={match.id} match={match} onComplete={() => void completeMatch(match.id)} />)
        )}

        <SectionHeader title="Pending bids" count={pendingBids.length} icon="time" />
        {pendingBids.map((match) => (
          <View
            key={match.id}
            className={`mb-3 rounded-[26px] border p-4 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
            <Text className={`mb-1 text-lg font-black ${titleClass}`}>{match.task.title}</Text>
            <Text className={`text-sm leading-5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{match.bid_note}</Text>
          </View>
        ))}

        <SectionHeader title="Completed vouches" count={completed.length} icon="star" />
        {completed.map((match) => (
          <View key={match.id} className="mb-3 flex-row items-center gap-3 rounded-[26px] border border-emerald-400/20 bg-emerald-500/10 p-4">
            <Ionicons name="checkmark-circle" size={24} color="#34D399" />
            <View className="flex-1">
              <Text className={`font-black ${titleClass}`}>{match.task.title}</Text>
              <Text className={`text-sm ${isDark ? 'text-emerald-100' : 'text-emerald-700'}`}>Vouch added to your profile</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {celebratedMatch && <MatchRevealCard match={celebratedMatch} onDismiss={clearCelebration} />}
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

function PosterReviewCard({ match, onLikeBack }: { match: EnrichedMatch; onLikeBack: () => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <View className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-4 flex-row items-center gap-3">
        <Avatar profile={match.doer} size={58} />
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className={`text-lg font-black ${titleClass}`}>{match.doer.username}</Text>
            <VerifiedBadge verified={match.doer.is_verified} compact />
          </View>
          <Text className={`text-sm ${mutedClass}`}>{match.task.title}</Text>
        </View>
      </View>

      <View className="mb-4 flex-row gap-3">
        <TrustMetric icon="shield-checkmark" label="Vouches" value={match.doer.vouch_count.toString()} />
        <TrustMetric icon="star" label="Rating" value={match.doer.rating.toFixed(2)} />
      </View>

      <View className={`mb-4 rounded-[24px] p-4 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
        <Text className="mb-1 text-xs font-bold text-violet-200">Quick bid</Text>
        <Text className={`text-base leading-6 ${titleClass}`}>{match.bid_note}</Text>
      </View>

      <PrimaryButton label="Like Back" icon="heart" tone="emerald" onPress={onLikeBack} />
    </View>
  );
}

function TrustMetric({
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
    <View className={`flex-1 rounded-[24px] border p-4 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
      <Ionicons name={icon} size={18} color="#34D399" />
      <Text className={`mt-3 text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{value}</Text>
      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
    </View>
  );
}

function MatchRow({ match, onComplete }: { match: EnrichedMatch; onComplete: () => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <View className={`mb-4 rounded-[30px] border p-5 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <Link href={{ pathname: '/chat/[matchId]', params: { matchId: match.id } }} asChild>
        <Pressable>
          <View className="mb-4 flex-row items-center gap-3">
            <Avatar profile={match.poster} size={54} />
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className={`text-lg font-black ${titleClass}`}>{match.poster.username}</Text>
                <VerifiedBadge verified={match.poster.is_verified} compact />
              </View>
              <Text className={`text-sm ${mutedClass}`}>{match.task.title}</Text>
            </View>
            <Ionicons name={match.is_unlocked ? 'chatbubble-ellipses' : 'lock-closed'} size={22} color="#A78BFA" />
          </View>

          <View className={`mb-4 flex-row items-center justify-between rounded-[24px] p-4 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
            <View>
              <Text className="text-xs font-bold text-violet-200">{match.is_unlocked ? 'Chat open' : 'Paywall active'}</Text>
              <Text className={`text-base font-black ${titleClass}`}>{match.is_unlocked ? 'Finalize the gig' : 'Unlock for 5 credits'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </View>
        </Pressable>
      </Link>

      {match.is_unlocked && <PrimaryButton label="Mark Completed" icon="checkmark" tone="ghost" onPress={onComplete} />}
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
