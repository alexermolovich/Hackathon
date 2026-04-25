import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import type { Profile, Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { formatDistance, skillMatchCount } from '@/lib/gig-utils';

type TaskCardProps = {
  task: Task;
  currentUser: Profile;
  poster: Profile;
};

export function TaskCard({ task, currentUser, poster }: TaskCardProps) {
  const { isDark } = useGigStore();
  const matches = skillMatchCount(currentUser.skills, task.required_skills);
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-300' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';

  return (
    <View className={`h-full overflow-hidden rounded-[32px] border ${panelClass}`}>
      <View className="flex-1 justify-between p-6">
        <View>
          <View className="mb-5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Avatar profile={poster} size={46} />
              <View>
                <View className="flex-row items-center gap-2">
                  <Text className={`max-w-[150px] text-sm font-bold ${titleClass}`} numberOfLines={1}>
                    {poster.username}
                  </Text>
                  <VerifiedBadge verified={poster.is_verified} compact />
                </View>
                <Text className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{formatDistance(currentUser.location, task.location)}</Text>
              </View>
            </View>
            {task.is_boosted && (
              <View className="flex-row items-center gap-1 rounded-full bg-violet/20 px-3 py-2">
                <Ionicons name="sparkles" size={14} color="#C4B5FD" />
                <Text className="text-xs font-bold text-violet-200">Boosted</Text>
              </View>
            )}
          </View>

          <View className="mb-5 flex-row items-center gap-2">
            <Text className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-950'}`}>
              {task.category}
            </Text>
              <Text className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
              {matches}/{task.required_skills.length} Skills Match
            </Text>
          </View>

          {task.image_urls[0] && (
            <Image
              source={{ uri: task.image_urls[0] }}
              contentFit="cover"
              style={{ borderRadius: 24, height: 150, marginBottom: 18, width: '100%' }}
            />
          )}

          <Text className={`mb-4 text-4xl font-black leading-tight ${titleClass}`}>{task.title}</Text>
          <Text className={`text-base leading-6 ${mutedClass}`}>{task.description}</Text>
        </View>

        <View>
          <View className="mb-5 flex-row flex-wrap gap-2">
            {task.required_skills.map((skill) => {
              const isMatch = currentUser.skills.some((userSkill) => userSkill.toLowerCase() === skill.toLowerCase());

              return (
                <View
                  key={skill}
                  className={`rounded-full border px-3 py-2 ${
                    isMatch ? 'border-emerald-400/40 bg-emerald-500/20' : 'border-white/10 bg-white/5'
                  }`}>
                  <Text className={`text-xs font-semibold ${isMatch ? 'text-emerald-500' : isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {skill}
                  </Text>
                </View>
              );
            })}
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
              <Text className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{poster.vouch_count} posted vouches</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
