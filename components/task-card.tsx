import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import type { Profile, Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { formatDistance } from '@/lib/gig-utils';
import { resolveImageSource } from '@/lib/repo-images';

type TaskCardProps = {
  task: Task;
  currentUser: Profile;
  poster: Profile;
  revealPoster?: boolean;
  onPass?: () => void;
  onBid?: () => void;
};

export function TaskCard({ task, currentUser, poster, revealPoster = false, onPass, onBid }: TaskCardProps) {
  const { isDark } = useGigStore();
  const { height } = useWindowDimensions();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-300' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const dividerClass = isDark ? 'border-white/10' : 'border-zinc-200';
  const imageHeight = Math.max(height * 0.4, 260);
  const hasActions = Boolean(onPass || onBid);
  const taskImageSource = resolveImageSource(task.image_urls[0]);

  return (
    <View className={`h-full overflow-hidden rounded-[30px] border ${panelClass}`}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerClassName="pb-5">
        <View className={isDark ? 'bg-zinc-900' : 'bg-zinc-200'} style={{ height: imageHeight }}>
          {taskImageSource ? (
            <Image
              source={taskImageSource}
              contentFit="cover"
              style={{ height: '100%', width: '100%' }}
            />
          ) : (
            <View className="h-full items-center justify-center gap-3 px-6">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-violet/20">
                <Ionicons name="image" size={30} color="#A78BFA" />
              </View>
              <Text className={`text-center text-sm font-semibold ${mutedClass}`}>Gig image coming soon</Text>
            </View>
          )}
        </View>

        <View className="px-5 pt-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
            <InfoChip icon="navigate-circle" label={formatDistance(currentUser.location, task.location)} color="#8B5CF6" isDark={isDark} />
            <InfoChip icon="location" label={task.location_label} color="#10B981" isDark={isDark} />
            <InfoChip icon="cash" label={`$${task.budget} bid`} color="#F97316" isDark={isDark} />
          </ScrollView>

          <Text className={`mt-4 text-3xl font-black leading-tight ${titleClass}`}>
            {task.title}
          </Text>
          <Text className={`mt-3 text-base leading-6 ${mutedClass}`}>
            {task.description}
          </Text>

          <View className={`mt-5 flex-row flex-wrap items-center justify-between gap-3 border-y py-4 ${dividerClass}`}>
            <View className="min-w-[150px] flex-1 flex-row items-center gap-3">
              {revealPoster ? <Avatar profile={poster} size={50} /> : <HiddenPosterAvatar poster={poster} />}
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className={`text-base font-black ${titleClass}`} numberOfLines={1}>
                    {revealPoster ? poster.username : 'Poster hidden'}
                  </Text>
                  {revealPoster && <VerifiedBadge verified={poster.is_verified} compact />}
                </View>
                <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} numberOfLines={1}>
                  Requester profile
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap items-center justify-end gap-2">
              <View className={`flex-row items-center gap-1 rounded-full px-3 py-2 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
                <Ionicons name="checkmark-done" size={15} color="#10B981" />
                <Text className={`text-xs font-bold ${titleClass}`}>
                  {poster.posted_vouch_count} completed
                </Text>
              </View>
              {task.is_boosted ? (
                <View className="flex-row items-center gap-1 rounded-full bg-orange-500/20 px-3 py-2">
                  <Ionicons name="flame" size={14} color="#F97316" />
                  <Text className="text-xs font-bold text-orange-300">Boosted</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="mt-1">
            <DetailRow icon="calendar" label="Date wanted" value={task.date_window || 'Flexible'} isDark={isDark} />
            <DetailRow icon="pricetag" label="Category" value={task.category} isDark={isDark} />
            <DetailRow icon="star" label="Requester rating" value={poster.rating.toFixed(2)} isDark={isDark} />
            <DetailRow icon="time" label="Posted" value={formatPostedAt(task.created_at)} isDark={isDark} />
            {task.required_skills.length > 0 ? (
              <DetailRow icon="construct" label="Helpful skills" value={task.required_skills.join(', ')} isDark={isDark} />
            ) : null}
          </View>

          {hasActions ? (
            <View className={`mt-4 flex-row gap-3 border-t pt-4 ${dividerClass}`}>
              {onPass ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onPass}
                  className={`min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border px-4 ${
                    isDark ? 'border-rose-300/40 bg-rose-500/10' : 'border-rose-200 bg-rose-50'
                  }`}>
                  <Ionicons name="close" size={22} color="#F87171" />
                  <Text className="text-base font-black text-rose-400">Pass</Text>
                </Pressable>
              ) : null}
              {onBid ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onBid}
                  className={`min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 ${
                    isDark ? 'bg-emerald' : 'bg-emerald'
                  }`}>
                  <Ionicons name="heart" size={20} color="#FFFFFF" />
                  <Text className="text-base font-black text-white">Bid</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

type InfoChipProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  isDark: boolean;
};

function InfoChip({ icon, label, color, isDark }: InfoChipProps) {
  return (
    <View className={`h-10 flex-row items-center gap-2 rounded-full border px-3 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
      <Ionicons name={icon} size={15} color={color} />
      <Text className={`max-w-[170px] text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

type DetailRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isDark: boolean;
};

function DetailRow({ icon, label, value, isDark }: DetailRowProps) {
  return (
    <View className={`flex-row items-center gap-3 border-b py-3 ${isDark ? 'border-white/10' : 'border-zinc-200'}`}>
      <View className={`h-9 w-9 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
        <Ionicons name={icon} size={17} color={isDark ? '#D4D4D8' : '#52525B'} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</Text>
        <Text className={`mt-0.5 text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function HiddenPosterAvatar({ poster }: { poster: Profile }) {
  const avatarSource = resolveImageSource(poster.avatar_url);

  return (
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/25">
      {avatarSource ? (
        <>
          <Image source={avatarSource} style={{ height: 48, width: 48 }} contentFit="cover" />
          <BlurView intensity={28} tint="dark" className="absolute inset-0" />
        </>
      ) : (
        <Ionicons name="person" size={22} color="#C4B5FD" />
      )}
    </View>
  );
}

function formatPostedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
