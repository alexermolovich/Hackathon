import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TaskComposer } from '@/components/task-composer';
import { useGigStore } from '@/lib/gig-store';

export default function CreateTaskScreen() {
  const { isDark } = useGigStore();

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-zinc-100'}`}>
      <View className="flex-1 px-5 pt-2">
        <TaskComposer />
      </View>
    </SafeAreaView>
  );
}
