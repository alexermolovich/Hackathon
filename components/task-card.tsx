import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import type { Profile, Task } from '@/lib/gig-types';
import { formatDistance, skillMatchCount } from '@/lib/gig-utils';

type TaskCardProps = {
  task: Task;
  currentUser: Profile;
  poster: Profile;
};

export function TaskCard({ task, currentUser, poster }: TaskCardProps) {
  const matches = skillMatchCount(currentUser.skills, task.required_skills);

  return (
    <View className="h-full overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950">
      <View className="flex-1 justify-between p-6">
        <View>
          <View className="mb-5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Avatar profile={poster} size={46} />
              <View>
                <View className="flex-row items-center gap-2">
                  <Text className="max-w-[150px] text-sm font-bold text-white" numberOfLines={1}>
                    {poster.username}
                  </Text>
                  <VerifiedBadge verified={poster.is_verified} compact />
                </View>
                <Text className="text-xs text-zinc-400">{formatDistance(currentUser.location, task.location)}</Text>
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
            <Text className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {task.category}
            </Text>
              <Text className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
              {matches}/{task.required_skills.length} Skills Match
            </Text>
          </View>

          <Text className="mb-4 text-4xl font-black leading-tight text-white">{task.title}</Text>
          <Text className="text-base leading-6 text-zinc-300">{task.description}</Text>
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
                  <Text className={`text-xs font-semibold ${isMatch ? 'text-emerald-100' : 'text-zinc-300'}`}>
                    {skill}
                  </Text>
                </View>
              );
            })}
          </View>

          <View className="flex-row items-end justify-between rounded-[28px] border border-white/10 bg-white/10 p-4">
            <View>
              <Text className="text-xs uppercase text-zinc-400">Gig budget</Text>
              <Text className="text-4xl font-black text-white">${task.budget}</Text>
            </View>
            <View className="items-end">
              <View className="mb-2 flex-row items-center gap-1">
                <Ionicons name="star" size={15} color="#FBBF24" />
                <Text className="font-bold text-white">{poster.rating.toFixed(2)}</Text>
              </View>
              <Text className="text-xs text-zinc-400">{poster.vouch_count} posted vouches</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
