import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CategorySelector } from '@/components/category-selector';
import { CreditBadge } from '@/components/credit-badge';
import { MatchRevealCard } from '@/components/match-reveal-card';
import { PrimaryButton } from '@/components/primary-button';
import { ProfilePanel } from '@/components/profile-panel';
import { RadiusSlider } from '@/components/radius-slider';
import { TaskCard } from '@/components/task-card';
import type { Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { APP_NAME } from '@/lib/sidehustle-config';

const QUICK_BID = 'I can help with this and keep you updated the whole way.';

export default function GigDeckScreen() {
  const {
    deck,
    profiles,
    profile,
    submitBid,
    isLiveMode,
    matches,
    celebratedMatchId,
    clearCelebration,
    isDark,
    updateRadius,
    updateInterests,
  } = useGigStore();
  const swiperRef = useRef<Swiper<Task>>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [bidNote, setBidNote] = useState(QUICK_BID);
  const [counterBid, setCounterBid] = useState('');
  const [availabilityWindow, setAvailabilityWindow] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const postersById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const celebratedMatch = matches.find((match) => match.id === celebratedMatchId);
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

  function onSwipedRight(cardIndex: number) {
    const task = deck[cardIndex];

    if (!task) {
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedTask(task);
    setBidNote(QUICK_BID);
    setCounterBid(String(task.budget));
    setAvailabilityWindow(task.date_window);
  }

  async function submitCounterBid() {
    if (!selectedTask) {
      return;
    }

    const parsedCounterBid = Number(counterBid);

    if (!bidNote.trim() || !Number.isFinite(parsedCounterBid) || parsedCounterBid < 1) {
      Alert.alert('Bid details needed', 'Add a counter bid and a short note.');
      return;
    }

    await submitBid(selectedTask, {
      bidNote,
      counterBid: parsedCounterBid,
      availabilityWindow,
    });
    setSelectedTask(null);
    Alert.alert('Bid sent', 'If the gig starter picks you, it will appear in Hustles.');
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedTask(null);
        setProfileOpen(false);
        setSettingsOpen(false);
        setPurchaseOpen(false);
      };
    }, []),
  );

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <View className="flex-1 px-5 pb-4 pt-2">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-orange-400">{APP_NAME}</Text>
            <Text className={`text-3xl font-black ${titleClass}`}>Find gigs</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <CreditBadge credits={profile.credits} onPress={() => setPurchaseOpen(true)} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setProfileOpen(true)}
              className={`h-11 w-11 items-center justify-center rounded-full border ${panelClass}`}>
              <Ionicons name="ellipsis-horizontal" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setSettingsOpen(true)}
          className={`mb-4 flex-row items-center justify-between rounded-[28px] border px-4 py-3 ${panelClass}`}>
          <View className="flex-1 flex-row items-center gap-2">
            <Ionicons name="options" size={18} color="#8B5CF6" />
            <Text className={`font-semibold ${titleClass}`} numberOfLines={1}>
              {profile.search_radius} mi - {profile.interests.length} categories
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className={`h-2 w-2 rounded-full ${isLiveMode ? 'bg-emerald' : 'bg-violet'}`} />
            <Text className={`text-xs font-semibold ${mutedClass}`}>{isLiveMode ? 'Live' : 'Demo'}</Text>
          </View>
        </Pressable>

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
                <Ionicons name="briefcase" size={34} color="#C4B5FD" />
              </View>
              <Text className={`mb-2 text-center text-3xl font-black ${titleClass}`}>No gigs in range</Text>
              <Text className={`text-center text-base leading-6 ${mutedClass}`}>
                Adjust proximity or categories to open up the deck.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-5 h-20 items-center justify-center">
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
              <Ionicons name="flame" size={34} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={Boolean(selectedTask)} onRequestClose={() => setSelectedTask(null)}>
        <View className="flex-1 justify-end bg-black/75">
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View className={`rounded-t-[34px] border p-6 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
            <Text className="mb-2 text-sm font-bold text-orange-400">Counter bid</Text>
            <Text className={`mb-1 text-3xl font-black ${titleClass}`}>{selectedTask?.title}</Text>
            <Text className={`mb-5 text-sm ${mutedClass}`}>{selectedTask?.location_label}</Text>
            <View className="mb-5 flex-row gap-3">
              <View className="flex-1">
                <Text className={`mb-2 text-sm font-bold ${mutedClass}`}>Your bid</Text>
                <View className={`flex-row items-center rounded-[24px] border px-4 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
                  <Text className={`text-xl font-black ${titleClass}`}>$</Text>
                  <TextInput
                    value={counterBid}
                    onChangeText={setCounterBid}
                    keyboardType="numeric"
                    className={`flex-1 py-4 text-xl font-black ${titleClass}`}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className={`mb-2 text-sm font-bold ${mutedClass}`}>Availability</Text>
                <TextInput
                  value={availabilityWindow}
                  onChangeText={setAvailabilityWindow}
                  placeholder="Optional"
                  placeholderTextColor="#71717A"
                  className={`rounded-[24px] border px-4 py-4 text-base ${
                    isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
                  }`}
                />
              </View>
            </View>
            <TextInput
              multiline
              value={bidNote}
              onChangeText={setBidNote}
              placeholder="Tell the gig starter why you are a strong fit."
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
                onPress={() => void submitCounterBid()}
                disabled={!bidNote.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={settingsOpen} onRequestClose={() => setSettingsOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`max-h-[88%] rounded-t-[34px] border px-5 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
              <View className="mb-5 flex-row items-center justify-between">
                <View>
                  <Text className="text-sm font-bold text-orange-400">Deck settings</Text>
                  <Text className={`text-3xl font-black ${titleClass}`}>Tune gigs</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSettingsOpen(false)}
                  className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                  <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
                </Pressable>
              </View>
              <View className={`mb-5 rounded-[28px] border p-5 ${panelClass}`}>
                <RadiusSlider value={profile.search_radius} onChange={updateRadius} />
              </View>
              <View className={`mb-5 rounded-[28px] border p-5 ${panelClass}`}>
                <Text className={`mb-3 text-xl font-black ${titleClass}`}>Categories</Text>
                <CategorySelector selected={profile.interests} onChange={updateInterests} minSelected={1} />
              </View>
            </ScrollView>
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

      <BstPurchaseSheet visible={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
      {celebratedMatch && <MatchRevealCard match={celebratedMatch} onDismiss={clearCelebration} />}
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
