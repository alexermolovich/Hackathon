import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { TaskCard } from '@/components/task-card';
import type { Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';

const QUICK_BID = 'I can help with this right now!';

export default function GigDeckScreen() {
  const { deck, profiles, profile, submitBid, isLiveMode } = useGigStore();
  const swiperRef = useRef<Swiper<Task>>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [bidNote, setBidNote] = useState(QUICK_BID);
  const [sentTaskTitle, setSentTaskTitle] = useState<string | null>(null);

  const postersById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);

  function handlePass() {
    void Haptics.selectionAsync();
    swiperRef.current?.swipeLeft();
  }

  function handleBid() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swiperRef.current?.swipeRight();
  }

  function onSwipedRight(cardIndex: number) {
    const task = deck[cardIndex];

    if (!task) {
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedTask(task);
    setBidNote(QUICK_BID);
  }

  async function submitQuickBid() {
    if (!selectedTask || !bidNote.trim()) {
      return;
    }

    await submitBid(selectedTask, bidNote);
    setSentTaskTitle(selectedTask.title);
    setSelectedTask(null);
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-5 pb-4 pt-2">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-violet-200">GigSwipe</Text>
            <Text className="text-3xl font-black text-white">Nearby gigs</Text>
          </View>
          <CreditBadge credits={profile.credits} />
        </View>

        <View className="mb-4 flex-row items-center justify-between rounded-[28px] border border-white/10 bg-white/10 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="navigate-circle" size={18} color="#8B5CF6" />
            <Text className="font-semibold text-white">{profile.search_radius} mile radius</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className={`h-2 w-2 rounded-full ${isLiveMode ? 'bg-emerald' : 'bg-violet'}`} />
            <Text className="text-xs font-semibold text-zinc-300">{isLiveMode ? 'Live Supabase' : 'Demo data'}</Text>
          </View>
        </View>

        <View className="flex-1">
          {deck.length > 0 ? (
            <Swiper
              ref={swiperRef}
              cards={deck}
              renderCard={(task) => {
                const poster = postersById.get(task.poster_id) ?? profile;

                return <TaskCard task={task} currentUser={profile} poster={poster} />;
              }}
              onSwipedLeft={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              onSwipedRight={onSwipedRight}
              cardIndex={0}
              backgroundColor="transparent"
              stackSize={3}
              stackScale={7}
              stackSeparation={14}
              verticalSwipe={false}
              horizontalThreshold={90}
              animateOverlayLabelsOpacity
              containerStyle={styles.swiperContainer}
              cardStyle={styles.swiperCard}
              overlayLabels={{
                left: {
                  title: 'PASS',
                  style: {
                    label: styles.passLabel,
                    wrapper: styles.leftOverlay,
                  },
                },
                right: {
                  title: 'BID',
                  style: {
                    label: styles.bidLabel,
                    wrapper: styles.rightOverlay,
                  },
                },
              }}
            />
          ) : (
            <View className="flex-1 items-center justify-center rounded-[32px] border border-white/10 bg-white/10 px-8">
              <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-violet/20">
                <Ionicons name="location" size={34} color="#C4B5FD" />
              </View>
              <Text className="mb-2 text-center text-3xl font-black text-white">No gigs in range</Text>
              <Text className="text-center text-base leading-6 text-zinc-400">
                Increase your radius or add more skills from Profile to open up the deck.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-5 flex-row items-center justify-center gap-5">
          <Pressable
            accessibilityRole="button"
            onPress={handlePass}
            className="h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/10">
            <Ionicons name="close" size={31} color="#F87171" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleBid}
            className="h-20 w-20 items-center justify-center rounded-full bg-violet">
            <Ionicons name="flash" size={34} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
            className="h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/10">
            <Ionicons name="sparkles" size={28} color="#34D399" />
          </Pressable>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={Boolean(selectedTask)} onRequestClose={() => setSelectedTask(null)}>
        <View className="flex-1 justify-end bg-black/75">
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View className="rounded-t-[34px] border border-white/10 bg-zinc-950 p-6">
            <Text className="mb-2 text-sm font-bold text-violet-200">Quick bid</Text>
            <Text className="mb-5 text-3xl font-black text-white">{selectedTask?.title}</Text>
            <TextInput
              multiline
              value={bidNote}
              onChangeText={setBidNote}
              placeholder="Tell the poster why you are a strong fit."
              placeholderTextColor="#71717A"
              className="mb-5 min-h-28 rounded-[24px] border border-white/10 bg-white/10 p-4 text-base leading-6 text-white"
              textAlignVertical="top"
            />
            <View className="flex-row gap-3">
              <PrimaryButton label="Cancel" tone="ghost" icon="close" onPress={() => setSelectedTask(null)} style={{ flex: 1 }} />
              <PrimaryButton
                label="Send Bid"
                icon="send"
                onPress={() => void submitQuickBid()}
                disabled={!bidNote.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={Boolean(sentTaskTitle)} onRequestClose={() => setSentTaskTitle(null)}>
        <View className="flex-1 items-center justify-center bg-black/80 px-6">
          <View className="w-full rounded-[32px] border border-emerald-400/30 bg-emerald-500/20 p-6">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-emerald">
              <Ionicons name="checkmark" size={34} color="#FFFFFF" />
            </View>
            <Text className="mb-2 text-3xl font-black text-white">Bid sent</Text>
            <Text className="mb-6 text-base leading-6 text-emerald-50">
              The poster can view your profile, vouch score, and selfie badge. If they like you back, chat unlocks for 5
              credits.
            </Text>
            <PrimaryButton label="Back to Deck" tone="emerald" icon="albums" onPress={() => setSentTaskTitle(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  swiperContainer: {
    flex: 1,
  },
  swiperCard: {
    height: '100%',
    left: 0,
    right: 0,
    top: 0,
    width: '100%',
  },
  leftOverlay: {
    alignItems: 'flex-end',
    padding: 24,
  },
  rightOverlay: {
    alignItems: 'flex-start',
    padding: 24,
  },
  passLabel: {
    borderColor: '#F87171',
    borderRadius: 18,
    borderWidth: 3,
    color: '#F87171',
    fontSize: 32,
    fontWeight: '900',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bidLabel: {
    borderColor: '#34D399',
    borderRadius: 18,
    borderWidth: 3,
    color: '#34D399',
    fontSize: 32,
    fontWeight: '900',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
