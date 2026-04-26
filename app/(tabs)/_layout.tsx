import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { useGigStore } from '@/lib/gig-store';
import { getUnreadMessageCount, hasUnseenAcceptedOffer, hasUnseenCounterBid } from '@/lib/gig-utils';

export default function TabLayout() {
  const { isDark, matches, messages, profile } = useGigStore();
  const forgeBadgeCount =
    matches.filter((match) => hasUnseenCounterBid(match, profile.id)).length +
    matches.reduce(
      (total, match) =>
        match.status === 'matched' && match.task.poster_id === profile.id
          ? total + getUnreadMessageCount(match, messages, profile.id)
          : total,
      0,
    );
  const hustlesBadgeCount =
    matches.filter((match) => hasUnseenAcceptedOffer(match, profile.id)).length +
    matches.reduce(
      (total, match) =>
        match.status === 'matched' && match.doer_id === profile.id
          ? total + getUnreadMessageCount(match, messages, profile.id)
          : total,
      0,
    );

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: isDark ? '#FFFFFF' : '#18181B',
        tabBarInactiveTintColor: '#71717A',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 86,
          paddingTop: 8,
          paddingBottom: 20,
          borderTopWidth: 1,
          borderTopColor: isDark ? '#18181B' : '#E4E4E7',
          backgroundColor: isDark ? '#050505' : '#FFFFFF',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="forge"
        options={{
          title: 'Forge',
          tabBarBadge: badgeValue(forgeBadgeCount),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'hammer' : 'hammer-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Swipe',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flame' : 'flame-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Hustles',
          tabBarBadge: badgeValue(hustlesBadgeCount),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

function badgeValue(count: number) {
  if (count <= 0) {
    return undefined;
  }

  return count > 9 ? '9+' : count;
}
