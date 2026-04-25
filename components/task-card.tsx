import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import type { Profile, Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { formatDistance } from '@/lib/gig-utils';

type TaskCardProps = {
  task: Task;
  currentUser: Profile;
  poster: Profile;
  revealPoster?: boolean;
};

export function TaskCard({ task, currentUser, poster, revealPoster = false }: TaskCardProps) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-300' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';

  return (
    <View className={`h-full overflow-hidden rounded-[32px] border ${panelClass}`}>
      <View className="flex-1 justify-between p-5">
        <View>
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <View className="flex-1 flex-row items-center gap-3">
              {revealPoster ? <Avatar profile={poster} size={48} /> : <HiddenPosterAvatar poster={poster} />}
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className={`max-w-[160px] text-sm font-bold ${titleClass}`} numberOfLines={1}>
                    {revealPoster ? poster.username : 'Poster hidden'}
                  </Text>
                  {revealPoster && <VerifiedBadge verified={poster.is_verified} compact />}
                </View>
                <Text className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {poster.posted_vouch_count} gigs completed for them
                </Text>
              </View>
            </View>
            {task.is_boosted && (
              <View className="flex-row items-center gap-1 rounded-full bg-orange-500/20 px-3 py-2">
                <Ionicons name="flame" size={14} color="#F97316" />
                <Text className="text-xs font-bold text-orange-300">Boosted</Text>
              </View>
            )}
          </View>

          {task.image_urls[0] && (
            <Image
              source={{ uri: task.image_urls[0] }}
              contentFit="cover"
              style={{ borderRadius: 24, height: 158, marginBottom: 16, width: '100%' }}
            />
          )}

          <View className="mb-4 flex-row flex-wrap gap-2">
            <Text className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-950'}`}>
              {task.category}
            </Text>
            <Text className="rounded-full bg-violet/20 px-3 py-1 text-xs font-semibold text-violet-300">
              {task.location_label}
            </Text>
          </View>

          <Text className={`mb-3 text-4xl font-black leading-tight ${titleClass}`} numberOfLines={3}>
            {task.title}
          </Text>
          <Text className={`text-base leading-6 ${mutedClass}`} numberOfLines={4}>
            {task.description}
          </Text>
        </View>

        <View>
          <View className="mb-4 flex-row flex-wrap gap-2">
            <View className={`flex-row items-center gap-1 rounded-full border px-3 py-2 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-100'}`}>
              <Ionicons name="navigate-circle" size={15} color="#8B5CF6" />
              <Text className={`text-xs font-semibold ${mutedClass}`}>
                {formatDistance(currentUser.location, task.location)}
              </Text>
            </View>
            {task.date_window ? (
              <View className={`flex-row items-center gap-1 rounded-full border px-3 py-2 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-100'}`}>
                <Ionicons name="calendar" size={15} color="#10B981" />
                <Text className={`text-xs font-semibold ${mutedClass}`} numberOfLines={1}>
                  {task.date_window}
                </Text>
              </View>
            ) : null}
          </View>

          <View className={`flex-row items-end justify-between rounded-[28px] border p-4 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
            <View>
              <Text className={`text-xs uppercase ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Gig budget</Text>
              <Text className={`text-4xl font-black ${titleClass}`}>${task.budget}</Text>
            </View>
            <View className="items-end">
              <View className="mb-2 flex-row items-center gap-1">
                <Ionicons name="star" size={15} color="#FBBF24" />
                <Text className={`font-bold ${titleClass}`}>{poster.rating.toFixed(2)}</Text>
              </View>
              <Text className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>requestor rating</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function HiddenPosterAvatar({ poster }: { poster: Profile }) {
  return (
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/25">
      {poster.avatar_url ? (
        <>
          <Image source={{ uri: poster.avatar_url }} style={{ height: 48, width: 48 }} contentFit="cover" />
          <BlurView intensity={28} tint="dark" className="absolute inset-0" />
        </>
      ) : (
        <Ionicons name="person" size={22} color="#C4B5FD" />
      )}
    </View>
  );
}
