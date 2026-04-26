import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { useGigStore } from '@/lib/gig-store';
import { formatDistance, getTaskCategoryLabels } from '@/lib/gig-utils';
import { formatVisibleRating } from '@/lib/rating-utils';
import { resolveImageSource } from '@/lib/repo-images';
import { APP_NAME } from '@/lib/sidehustle-config';

export default function GigDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId?: string | string[] }>();
  const router = useRouter();
  const { profile, profiles, tasks, matches, isDark } = useGigStore();
  const resolvedTaskId = Array.isArray(taskId) ? taskId[0] : taskId;
  const task = tasks.find((item) => item.id === resolvedTaskId);
  const poster = task ? profiles.find((item) => item.id === task.poster_id) : null;
  const taskMatches = task ? matches.filter((match) => match.task.id === task.id) : [];
  const myMatch = taskMatches.find((match) => match.doer_id === profile.id);
  const isMyPost = Boolean(task && task.poster_id === profile.id);
  const completedMatch = taskMatches.find((match) => match.status === 'completed');
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const taskImageSource = resolveImageSource(task?.image_urls[0]);
  const categoriesText = task ? getTaskCategoryLabels(task).join(', ') : '';

  function closePage() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  if (!task || !poster) {
    return (
      <SafeAreaView className={`flex-1 ${shellClass}`}>
        <View className="flex-1 items-center justify-center px-6">
          <View className={`w-full items-center rounded-[30px] border p-6 ${panelClass}`}>
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-violet/20">
              <Ionicons name="briefcase" size={28} color="#A78BFA" />
            </View>
            <Text className={`mb-2 text-center text-2xl font-black ${titleClass}`}>Gig not found</Text>
            <Text className={`mb-5 text-center text-sm leading-5 ${mutedClass}`}>
              This gig may have moved or is no longer available.
            </Text>
            <PrimaryButton label="Close" icon="close" onPress={closePage} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-orange-400">{APP_NAME}</Text>
            <Text className={`text-3xl font-black ${titleClass}`}>{task.status === 'archived' ? 'Finished Gig' : 'Gig'}</Text>
          </View>
          <Pressable
            accessibilityLabel="Close gig"
            accessibilityRole="button"
            onPress={closePage}
            className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-white'}`}>
            <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
          </Pressable>
        </View>

        <View className={`mb-5 overflow-hidden rounded-[32px] border ${panelClass}`}>
          {taskImageSource ? (
            <Image source={taskImageSource} style={{ height: 220, width: '100%' }} contentFit="cover" />
          ) : (
            <View className="h-48 items-center justify-center bg-violet/20">
              <Ionicons name="briefcase" size={42} color="#C4B5FD" />
            </View>
          )}

          <View className="p-5">
            <View className="mb-4 flex-row flex-wrap gap-2">
              <Badge icon="pricetag" label={categoriesText} />
              <Badge icon="navigate-circle" label={task.location_label} />
              {task.is_boosted ? <Badge icon="flame" label={`${task.boost_days}d boost`} tone="orange" /> : null}
            </View>

            <Text className={`mb-3 text-3xl font-black leading-tight ${titleClass}`}>{task.title}</Text>
            <Text className={`text-base leading-6 ${mutedClass}`}>{task.description}</Text>
          </View>
        </View>

        <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
          <View className="mb-4 flex-row items-center gap-3">
            <Avatar profile={poster} size={54} />
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className={`text-lg font-black ${titleClass}`} numberOfLines={1}>{poster.username}</Text>
                <VerifiedBadge verified={poster.is_verified} compact />
              </View>
              <Text className={`text-sm ${mutedClass}`}>{poster.posted_vouch_count} posted gigs</Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <Metric icon="star" label="Gigachad Rating" value={formatVisibleRating(poster, 'poster')} />
            <Metric icon="medal" label="Hustles Completed" value={poster.vouch_count.toString()} />
          </View>
        </View>

        <View className="mb-5 flex-row gap-3">
          <Metric icon="cash" label="Budget" value={`$${task.budget}`} />
          {isMyPost ? (
            <Metric icon="briefcase" label="Status" value={task.status === 'archived' ? 'Archived' : 'Open'} />
          ) : (
            <Metric icon="navigate-circle" label="Distance" value={formatDistance(profile.location, task.location)} />
          )}
        </View>
        <View className="mb-5 flex-row gap-3">
          <Metric icon="calendar" label="When" value={task.date_window || 'Flexible'} />
          <Metric icon="people" label="Bids" value={String(taskMatches.filter((match) => match.status !== 'completed').length)} />
        </View>

        {task.required_skills.length > 0 ? (
          <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
            <Text className={`mb-3 text-xl font-black ${titleClass}`}>Skills</Text>
            <View className="flex-row flex-wrap gap-2">
              {task.required_skills.map((skill) => (
                <View key={skill} className={`rounded-full border px-3 py-2 ${softClass}`}>
                  <Text className={`text-sm font-bold ${titleClass}`}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className={`rounded-[30px] border p-5 ${panelClass}`}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className={`text-xl font-black ${titleClass}`}>Status</Text>
            <Ionicons name={task.status === 'archived' ? 'checkmark-circle' : 'time'} size={24} color="#8B5CF6" />
          </View>

          {completedMatch ? (
            <Text className={`text-sm leading-5 ${mutedClass}`}>
              Finished by {completedMatch.doer.username} for ${completedMatch.counter_bid}.
            </Text>
          ) : isMyPost ? (
            <Text className={`text-sm leading-5 ${mutedClass}`}>
              You are the Gigachad for this gig. Open GigHub for bids and picks.
            </Text>
          ) : myMatch ? (
            <Text className={`text-sm leading-5 ${mutedClass}`}>
              Your ${myMatch.counter_bid} bid is{' '}
              {myMatch.status === 'pending'
                ? 'waiting for the Gigachad'
                : myMatch.doer_completed_at
                  ? 'waiting for the Gigachad to confirm completion'
                  : 'picked'}.
            </Text>
          ) : (
            <Text className={`text-sm leading-5 ${mutedClass}`}>
              Open in the swipe deck to send a bid when it appears in range.
            </Text>
          )}

          {myMatch?.status === 'matched' ? (
            <Link href={{ pathname: '/chat/[matchId]', params: { matchId: myMatch.id } }} asChild>
              <Pressable accessibilityRole="button" className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-3xl bg-violet px-5">
                <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
                <Text className="text-sm font-bold text-white">Open Chat</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({
  icon,
  label,
  tone = 'violet',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'violet' | 'orange';
}) {
  const { isDark } = useGigStore();
  const color = tone === 'orange' ? '#F97316' : '#8B5CF6';

  return (
    <View className={`flex-row items-center gap-1 rounded-full px-3 py-2 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Ionicons name={icon} size={14} color={color} />
      <Text className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`flex-1 rounded-[24px] border p-4 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-2 flex-row items-center gap-1">
        <Ionicons name={icon} size={15} color={icon === 'cash' || icon === 'flame' ? '#F97316' : '#8B5CF6'} />
        <Text className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
      </View>
      <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={1}>{value}</Text>
    </View>
  );
}
