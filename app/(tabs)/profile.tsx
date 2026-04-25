import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfilePanel } from '@/components/profile-panel';
import { useGigStore } from '@/lib/gig-store';

export default function ProfileScreen() {
  const { isDark } = useGigStore();
  const router = useRouter();

  function closeProfile() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-zinc-100'}`}>
      <ProfilePanel onClose={closeProfile} />
    </SafeAreaView>
  );
}
