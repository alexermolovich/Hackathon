import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreditBadge } from '@/components/credit-badge';
import { MatchRevealCard } from '@/components/match-reveal-card';
import { PrimaryButton } from '@/components/primary-button';
import { ProfilePanel } from '@/components/profile-panel';
import { TaskComposer } from '@/components/task-composer';
import { TaskCard } from '@/components/task-card';
import type { Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';

const QUICK_BID = 'I can help with this right now!';

export default function GigDeckScreen() {
  const { deck, profiles, profile, submitMatchedBid, isLiveMode, matches, isDark } = useGigStore();
  const swiperRef = useRef<Swiper<Task>>(null);
  const suppressBidModalRef = useRef(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [bidNote, setBidNote] = useState(QUICK_BID);
  const [postOpen, setPostOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [revealedMatchId, setRevealedMatchId] = useState<string | null>(null);

  const postersById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const revealedMatch = matches.find((match) => match.id === revealedMatchId);
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const panelClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white';

  function handlePass() {
    void Haptics.selectionAsync();
    swiperRef.current?.swipeLeft();
  }

  function handleBid() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swiperRef.current?.swipeRight();
  }

  async function handleInstantMatch() {
    const task = deck[activeCardIndex];

    if (!task) {
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const match = await submitMatchedBid(task, QUICK_BID);
    setRevealedMatchId(match.id);
    suppressBidModalRef.current = true;
    swiperRef.current?.swipeRight();
  }

  function onSwipedRight(cardIndex: number) {
    if (suppressBidModalRef.current) {
      suppressBidModalRef.current = false;
      return;
    }

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

    const match = await submitMatchedBid(selectedTask, bidNote);
    setRevealedMatchId(match.id);
    setSelectedTask(null);
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedTask(null);
        setPostOpen(false);
        setProfileOpen(false);
        setRevealedMatchId(null);
      };
    }, []),
  );

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <View className="flex-1 px-5 pb-4 pt-2">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-violet-200">GigSwipe</Text>
            <Text className={`text-3xl font-black ${titleClass}`}>Nearby gigs</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <CreditBadge credits={profile.credits} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setProfileOpen(true)}
              className={`h-11 w-11 items-center justify-center rounded-full border ${panelClass}`}>
              <Ionicons name="ellipsis-horizontal" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          </View>
        </View>

        <View className={`mb-4 flex-row items-center justify-between rounded-[28px] border px-4 py-3 ${panelClass}`}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="navigate-circle" size={18} color="#8B5CF6" />
            <Text className={`font-semibold ${titleClass}`}>Rapid City - 8 mile radius</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className={`h-2 w-2 rounded-full ${isLiveMode ? 'bg-emerald' : 'bg-violet'}`} />
            <Text className={`text-xs font-semibold ${mutedClass}`}>{isLiveMode ? 'Live Supabase' : 'Demo data'}</Text>
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
              onSwiped={(cardIndex) => setActiveCardIndex(cardIndex + 1)}
              cardIndex={activeCardIndex}
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
            <View className={`flex-1 items-center justify-center rounded-[32px] border px-8 ${panelClass}`}>
              <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-violet/20">
                <Ionicons name="location" size={34} color="#C4B5FD" />
              </View>
              <Text className={`mb-2 text-center text-3xl font-black ${titleClass}`}>No gigs in range</Text>
              <Text className={`text-center text-base leading-6 ${mutedClass}`}>
                Increase your radius or add more skills from Profile to open up the deck.
              </Text>
            </View>
          )}
        </View>

        <View className="relative mt-5 h-20 items-center justify-center">
          <View className="flex-row items-center gap-5">
            <Pressable
              accessibilityRole="button"
              onPress={handlePass}
              className={`h-16 w-16 items-center justify-center rounded-full border ${panelClass}`}>
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
              onPress={() => void handleInstantMatch()}
              className={`h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 ${
                isDark ? 'bg-emerald-500/20' : 'bg-emerald-500/10'
              }`}>
              <Ionicons name="sparkles" size={28} color="#10B981" />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPostOpen(true)}
            className="h-16 w-16 items-center justify-center rounded-full bg-violet"
            style={{ position: 'absolute', right: -6 }}>
            <Ionicons name="add" size={34} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={Boolean(selectedTask)} onRequestClose={() => setSelectedTask(null)}>
        <View className="flex-1 justify-end bg-black/75">
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View className={`rounded-t-[34px] border p-6 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
            <Text className="mb-2 text-sm font-bold text-violet-200">Quick bid</Text>
            <Text className={`mb-5 text-3xl font-black ${titleClass}`}>{selectedTask?.title}</Text>
            <TextInput
              multiline
              value={bidNote}
              onChangeText={setBidNote}
              placeholder="Tell the poster why you are a strong fit."
              placeholderTextColor="#71717A"
              className={`mb-5 min-h-28 rounded-[24px] border p-4 text-base leading-6 ${
                isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
              }`}
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

      <Modal transparent animationType="slide" visible={postOpen} onRequestClose={() => setPostOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`max-h-[88%] rounded-t-[34px] border px-5 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <TaskComposer onCreated={() => setPostOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`max-h-[88%] rounded-t-[34px] border px-5 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
              <ProfilePanel />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {revealedMatch && <MatchRevealCard match={revealedMatch} onDismiss={() => setRevealedMatchId(null)} />}
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
