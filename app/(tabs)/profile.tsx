import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfilePanel } from '@/components/profile-panel';
import { useGigStore } from '@/lib/gig-store';

export default function ProfileScreen() {
  const { isDark } = useGigStore();

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-zinc-100'}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
        <ProfilePanel />
      </ScrollView>
    </SafeAreaView>
  );
}
