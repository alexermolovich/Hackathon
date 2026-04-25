import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { MatchRouteMap } from '@/components/match-route-map';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import type { EnrichedMatch, Profile, Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';

type MatchRevealCardProps = {
  match: EnrichedMatch;
  onDismiss: () => void;
};

export function MatchRevealCard({ match, onDismiss }: MatchRevealCardProps) {
  const { profile, isDark } = useGigStore();
  const [targetMode, setTargetMode] = useState<'person' | 'task'>('task');
  const scale = useSharedValue(1);

  const participant = match.doer_id === profile.id ? match.poster : match.doer;
  const target = useMemo(
    () => (targetMode === 'person' ? participant.location : match.task.location),
    [match.task.location, participant.location, targetMode],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function pulse() {
    scale.value = withSpring(0.985, { damping: 12 }, () => {
      scale.value = withSpring(1);
    });
  }

  return (
    <View className="justify-end" style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} />
      <Animated.View
        className={`overflow-hidden rounded-t-[36px] border ${
          isDark ? 'border-emerald-300/30' : 'border-emerald-200'
        }`}
        style={[
          styles.sheet,
          { backgroundColor: isDark ? '#09090B' : '#FFFFFF' },
          cardStyle,
        ]}>
        <View style={styles.mapShell} onStartShouldSetResponder={() => true}>
          <MatchRouteMap origin={profile.location} target={target} />
        </View>

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={onDismiss} className="mb-4">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald">
                <Ionicons name="heart" size={22} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>Match made</Text>
                <Text className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>{participant.username} liked you back</Text>
              </View>
            </View>
          </Pressable>

          <View className="mb-4 flex-row gap-2">
            <TargetButton active={targetMode === 'task'} label="Task" icon="briefcase" onPress={() => setTargetMode('task')} />
            <TargetButton active={targetMode === 'person'} label="Person" icon="person" onPress={() => setTargetMode('person')} />
          </View>

          <Pressable onPress={onDismiss} className="mb-5">
            {targetMode === 'person' ? (
              <PersonDetail participant={participant} />
            ) : (
              <TaskDetail task={match.task} />
            )}
          </Pressable>

          <View className="flex-row gap-3">
            <PrimaryButton label="Keep Swiping" tone="ghost" icon="albums" onPress={onDismiss} style={{ flex: 1 }} />
            <Link href={{ pathname: '/chat/[matchId]', params: { matchId: match.id } }} asChild>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  pulse();
                  onDismiss();
                }}
                className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-3xl bg-emerald px-5">
                <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
                <Text className="text-sm font-bold text-white">Open Chat</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    elevation: 9999,
    zIndex: 9999,
  },
  sheet: {
    maxHeight: '92%',
    elevation: 10000,
    zIndex: 10000,
  },
  mapShell: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  detailScroll: {
    flexShrink: 1,
  },
  detailContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
});

function PersonDetail({ participant }: { participant: Profile }) {
  const { isDark } = useGigStore();

  return (
    <View
      className={`rounded-[28px] border p-4 ${
        isDark ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'
      }`}>
      <View className="flex-row items-center gap-3">
        <Avatar profile={participant} size={62} />
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{participant.username}</Text>
            <VerifiedBadge verified={participant.is_verified} compact />
          </View>
          <Text className={`text-sm leading-5 ${isDark ? 'text-emerald-50' : 'text-emerald-900'}`} numberOfLines={2}>
            {participant.bio}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <MiniMetric icon="shield-checkmark" label="Vouches" value={participant.vouch_count.toString()} />
        <MiniMetric icon="star" label="Rating" value={participant.rating.toFixed(2)} />
      </View>
    </View>
  );
}

function TaskDetail({ task }: { task: Task }) {
  const { isDark } = useGigStore();

  return (
    <View
      className={`rounded-[28px] border p-4 ${
        isDark ? 'border-violet/30 bg-violet/20' : 'border-violet/20 bg-violet/10'
      }`}>
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className={`flex-1 text-xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={2}>
          {task.title}
        </Text>
        <View className="rounded-full bg-violet px-3 py-2">
          <Text className="text-xs font-black text-white">${task.budget}</Text>
        </View>
      </View>
      <Text className={`text-sm leading-5 ${isDark ? 'text-violet-50' : 'text-violet-950'}`} numberOfLines={2}>
        {task.description}
      </Text>
    </View>
  );
}

function MiniMetric({
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
    <View className={`flex-1 rounded-[20px] px-3 py-3 ${isDark ? 'bg-black/25' : 'bg-white'}`}>
      <View className="mb-2 flex-row items-center gap-1">
        <Ionicons name={icon} size={15} color="#10B981" />
        <Text className={`text-xs font-bold ${isDark ? 'text-emerald-100' : 'text-emerald-800'}`}>{label}</Text>
      </View>
      <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{value}</Text>
    </View>
  );
}

function TargetButton({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { isDark } = useGigStore();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full ${
        active
          ? label === 'Person'
            ? 'bg-emerald'
            : 'bg-violet'
          : isDark
            ? 'border border-white/10 bg-white/10'
            : 'border border-zinc-200 bg-zinc-100'
      }`}>
      <Ionicons name={icon} size={16} color={active || isDark ? '#FFFFFF' : '#18181B'} />
      <Text className={`font-bold ${active || isDark ? 'text-white' : 'text-zinc-950'}`}>{label}</Text>
    </Pressable>
  );
}
