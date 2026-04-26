import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import {
  CalendarRangePicker,
  addMonths,
  formatDateLabel,
  formatDateRange,
  startOfDay,
  startOfMonth,
} from '@/components/calendar-range-picker';
import { CategorySelector } from '@/components/category-selector';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { ProfilePanel } from '@/components/profile-panel';
import { ProfileTrigger } from '@/components/profile-trigger';
import { RadiusSlider } from '@/components/radius-slider';
import { TaskCard } from '@/components/task-card';
import { useGigStore } from '@/lib/gig-store';
import type { Task } from '@/lib/gig-types';
import { APP_NAME } from '@/lib/sidehustle-config';

const QUICK_BID = 'I can help you with this!';
const webInputReset = { boxShadow: 'none', outlineStyle: 'none' } as const;

export default function GigDeckScreen() {
  const {
    deck,
    profiles,
    profile,
    submitBid,
    isDark,
    updateRadius,
    updateInterests,
    swipedTaskCount,
    rememberSwipedTask,
    clearSwipeContext,
  } = useGigStore();
  const swiperRef = useRef<Swiper<Task>>(null);
  const activeCardAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [swiperResetKey, setSwiperResetKey] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);
  const [bidNote, setBidNote] = useState(QUICK_BID);
  const [counterBid, setCounterBid] = useState('');
  const [availabilityWindow, setAvailabilityWindow] = useState('');
  const [availabilityCalendarOpen, setAvailabilityCalendarOpen] = useState(false);
  const [availabilityRangeStart, setAvailabilityRangeStart] = useState<Date | null>(null);
  const [availabilityRangeEnd, setAvailabilityRangeEnd] = useState<Date | null>(null);
  const [availabilityVisibleMonth, setAvailabilityVisibleMonth] = useState(startOfMonth(new Date()));
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const { width } = useWindowDimensions();

  const postersById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const panelClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white';
  const deckSignature = useMemo(() => deck.map((task) => task.id).join('|'), [deck]);
  const hasVisibleCard = activeCardIndex < deck.length;
  const nextPreviewTask = hasVisibleCard ? deck[activeCardIndex + 1] ?? null : null;
  const nextPreviewPoster = nextPreviewTask ? postersById.get(nextPreviewTask.poster_id) ?? profile : null;
  const compactHeader = width < 390;
  const deckBottomPadding = 20;
  const emptyTitle = deck.length === 0 ? 'No gigs in range' : "You're all caught up";
  const emptyMessage =
    deck.length === 0 ? 'Adjust proximity or categories to open up the deck.' : 'Check back soon or widen your filters for more gigs.';

  useEffect(() => {
    clearPendingActiveCardAdvance();
    setActiveCardIndex(0);
  }, [deckSignature]);

  function clearPendingActiveCardAdvance() {
    if (activeCardAdvanceTimeoutRef.current) {
      clearTimeout(activeCardAdvanceTimeoutRef.current);
      activeCardAdvanceTimeoutRef.current = null;
    }
  }

  function scheduleActiveCardAdvance(cardIndex: number) {
    clearPendingActiveCardAdvance();
    activeCardAdvanceTimeoutRef.current = setTimeout(() => {
      setActiveCardIndex(cardIndex + 1);
      activeCardAdvanceTimeoutRef.current = null;
    }, 0);
  }

  function handlePass() {
    if (!hasVisibleCard) {
      return;
    }

    void Haptics.selectionAsync();
    swiperRef.current?.swipeLeft();
  }

  function handleBid() {
    if (!hasVisibleCard) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swiperRef.current?.swipeRight();
  }

  function onSwipedRight(cardIndex: number) {
    const task = deck[cardIndex];

    if (!task) {
      return;
    }

    scheduleActiveCardAdvance(cardIndex);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedTask(task);
    setSelectedTaskIndex(cardIndex);
    setBidNote(QUICK_BID);
    setCounterBid(String(task.budget));
    setAvailabilityWindow(task.date_window);
    setAvailabilityCalendarOpen(false);
    setAvailabilityRangeStart(null);
    setAvailabilityRangeEnd(null);
    setAvailabilityVisibleMonth(startOfMonth(new Date()));
  }

  function onSwipedLeft(cardIndex: number) {
    clearPendingActiveCardAdvance();
    const task = deck[cardIndex];

    if (task) {
      rememberSwipedTask(task.id);
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function closeBidSheet() {
    clearPendingActiveCardAdvance();
    const restoreIndex =
      selectedTaskIndex !== null && deck[selectedTaskIndex]?.id === selectedTask?.id
        ? selectedTaskIndex
        : deck.findIndex((task) => task.id === selectedTask?.id);

    setSelectedTask(null);
    setSelectedTaskIndex(null);

    if (restoreIndex >= 0) {
      setActiveCardIndex(restoreIndex);
      setSwiperResetKey((current) => current + 1);
    }
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
    setSelectedTaskIndex(null);
    Alert.alert('Bid sent', 'If the Gigachad picks you, it will appear in Hustles.');
  }

  function selectAvailabilityDate(day: Date) {
    const selected = startOfDay(day);

    if (!availabilityRangeStart || availabilityRangeEnd) {
      setAvailabilityRangeStart(selected);
      setAvailabilityRangeEnd(null);
      setAvailabilityWindow(formatDateLabel(selected));
      return;
    }

    if (selected.getTime() < availabilityRangeStart.getTime()) {
      setAvailabilityRangeStart(selected);
      setAvailabilityRangeEnd(null);
      setAvailabilityWindow(formatDateLabel(selected));
      return;
    }

    setAvailabilityRangeEnd(selected);
    setAvailabilityWindow(formatDateRange(availabilityRangeStart, selected));
  }

  function confirmClearSwipeContext() {
    setSettingsOpen(false);
    setTimeout(() => {
      Alert.alert(
        'Clear passed gigs?',
        'This brings previously passed gigs back into your swipe deck.',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', onPress: clearSwipeContext },
        ],
      );
    }, 0);
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        clearPendingActiveCardAdvance();
        setSelectedTask(null);
        setSelectedTaskIndex(null);
        setProfileOpen(false);
        setSettingsOpen(false);
        setPurchaseOpen(false);
      };
    }, []),
  );

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <View className="flex-1">
        <View className={`z-20 px-5 pb-3 pt-2 ${shellClass}`}>
          <View className={`${compactHeader ? 'gap-3' : 'flex-row items-center justify-between gap-3'}`}>
            <View className={`min-w-0 ${compactHeader ? '' : 'flex-1'}`}>
              <Text className="text-sm font-semibold text-orange-400">{APP_NAME}</Text>
              <Text className={`text-3xl font-black ${titleClass}`} numberOfLines={1}>
                Gigs
              </Text>
            </View>
            <View className={`${compactHeader ? 'w-full justify-end' : ''} flex-row items-center gap-2`}>
              <Pressable
                accessibilityLabel={`Open deck filters. ${profile.search_radius} mile radius, ${profile.interests.length} categories.`}
                accessibilityRole="button"
                onPress={() => setSettingsOpen(true)}
                className={`h-11 w-11 items-center justify-center rounded-full border ${
                  isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'
                }`}>
                <Ionicons name="options" size={21} color={isDark ? '#FFFFFF' : '#18181B'} />
              </Pressable>
              <CreditBadge credits={profile.credits} onPress={() => setPurchaseOpen(true)} />
              <ProfileTrigger onPress={() => setProfileOpen(true)} />
            </View>
          </View>
        </View>

        <View className="mt-4 flex-1 px-6" style={[styles.deckViewport, { paddingBottom: deckBottomPadding }]}>
          {hasVisibleCard ? (
            <>
              {nextPreviewTask && nextPreviewPoster ? (
                <View pointerEvents="none" style={[styles.nextCardPreview, { bottom: deckBottomPadding }]}>
                  <TaskCard task={nextPreviewTask} poster={nextPreviewPoster} onPass={handlePass} onBid={handleBid} />
                </View>
              ) : null}
              <Swiper
                key={`${deckSignature}:${swiperResetKey}`}
                ref={swiperRef}
                cards={deck}
                renderCard={(task?: Task) => {
                  if (!task) {
                    return null;
                  }

                  const poster = postersById.get(task.poster_id) ?? profile;

                  return <TaskCard task={task} poster={poster} onPass={handlePass} onBid={handleBid} />;
                }}
                onSwipedLeft={onSwipedLeft}
                onSwipedRight={onSwipedRight}
                cardIndex={activeCardIndex}
                backgroundColor="transparent"
                stackSize={1}
                verticalSwipe={false}
                horizontalThreshold={90}
                animateOverlayLabelsOpacity
                containerStyle={{ ...styles.swiperContainer, bottom: deckBottomPadding }}
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
            </>
          ) : (
            <View className={`flex-1 items-center justify-center rounded-[32px] border px-8 ${panelClass}`}>
              <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-violet/20">
                <Ionicons name="briefcase" size={34} color="#C4B5FD" />
              </View>
              <Text className={`mb-2 text-center text-3xl font-black ${titleClass}`}>{emptyTitle}</Text>
              <Text className={`text-center text-base leading-6 ${mutedClass}`}>{emptyMessage}</Text>
            </View>
          )}
        </View>
      </View>

      <Modal transparent animationType="fade" visible={Boolean(selectedTask)} onRequestClose={closeBidSheet}>
        <View className="flex-1 justify-end bg-black/75">
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View className={`max-h-[92%] rounded-t-[34px] border ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
            <ScrollView contentContainerClassName="p-6" showsVerticalScrollIndicator={false}>
            <Text className="mb-2 text-sm font-bold text-orange-400">{APP_NAME}</Text>
            <Text className={`mb-1 text-3xl font-black ${titleClass}`}>{selectedTask?.title}</Text>
            <Text className={`mb-5 text-sm ${mutedClass}`}>{selectedTask?.location_label}</Text>
            <View className="mb-5 gap-3">
              <View>
                <Text className={`mb-2 text-sm font-bold ${mutedClass}`}>Your bid</Text>
                <View className={`flex-row items-center rounded-[24px] border px-4 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
                  <Text className={`text-xl font-black ${titleClass}`}>$</Text>
                  <TextInput
                    value={counterBid}
                    onChangeText={setCounterBid}
                    keyboardType="numeric"
                    className={`flex-1 py-4 text-xl font-black ${titleClass}`}
                    style={webInputReset as never}
                  />
                </View>
              </View>
              <View>
                <Text className={`mb-2 text-sm font-bold ${mutedClass}`}>Availability</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAvailabilityCalendarOpen((current) => !current)}
                  className={`min-h-14 flex-row items-center justify-between rounded-[24px] border px-4 ${
                    isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'
                  }`}>
                  <Text className={`flex-1 font-semibold ${availabilityWindow ? titleClass : mutedClass}`} numberOfLines={1}>
                    {availabilityWindow || 'Choose a date range'}
                  </Text>
                  <Ionicons name={availabilityCalendarOpen ? 'chevron-up' : 'calendar'} size={20} color="#8B5CF6" />
                </Pressable>
                {availabilityCalendarOpen ? (
                  <CalendarRangePicker
                    isDark={isDark}
                    onChangeMonth={(offset) => setAvailabilityVisibleMonth((current) => addMonths(current, offset))}
                    onDone={() => setAvailabilityCalendarOpen(false)}
                    onSelect={selectAvailabilityDate}
                    rangeEnd={availabilityRangeEnd}
                    rangeStart={availabilityRangeStart}
                    visibleMonth={availabilityVisibleMonth}
                  />
                ) : null}
              </View>
            </View>
            <TextInput
              multiline
              value={bidNote}
              onChangeText={setBidNote}
              placeholder="Tell the Gigachad why you are a strong fit."
              placeholderTextColor="#71717A"
              className={`mb-5 min-h-28 rounded-[24px] border p-4 text-base leading-6 ${
                isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
              }`}
              textAlignVertical="top"
            />
            <View className="flex-row gap-3">
              <PrimaryButton label="Cancel" tone="ghost" icon="close" onPress={closeBidSheet} style={{ flex: 1 }} />
              <PrimaryButton
                label="Send Bid"
                icon="send"
                onPress={() => void submitCounterBid()}
                disabled={!bidNote.trim()}
                style={{ flex: 1 }}
              />
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={settingsOpen} onRequestClose={() => setSettingsOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`max-h-[88%] rounded-t-[34px] border ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <View className={`z-10 flex-row items-center justify-between border-b px-5 pb-4 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
              <View>
                <Text className="text-sm font-bold text-orange-400">{APP_NAME}</Text>
                <Text className={`text-3xl font-black ${titleClass}`}>Tune gigs</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSettingsOpen(false)}
                className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8 pt-5">
              <View className={`mb-5 rounded-[28px] border p-5 ${panelClass}`}>
                <RadiusSlider value={profile.search_radius} onChange={updateRadius} />
                <View className={`mt-5 flex-row items-center justify-between rounded-[22px] px-4 py-3 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
                  <View className="min-w-0 flex-1 pr-3">
                    <Text className={`text-sm font-black ${titleClass}`}>Swipe context</Text>
                    <Text className={`text-xs font-semibold ${mutedClass}`} numberOfLines={1}>
                      {swipedTaskCount} passed gig{swipedTaskCount === 1 ? '' : 's'} hidden
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Clear passed gig context"
                    accessibilityRole="button"
                    disabled={swipedTaskCount === 0}
                    onPress={confirmClearSwipeContext}
                    className={`min-h-10 flex-row items-center justify-center gap-2 rounded-full px-4 ${
                      swipedTaskCount === 0 ? 'bg-zinc-500/20' : 'bg-violet'
                    }`}>
                    <Ionicons name="refresh" size={16} color="#FFFFFF" />
                    <Text className="text-sm font-black text-white">Clear</Text>
                  </Pressable>
                </View>
              </View>
              <View className={`mb-5 rounded-[28px] border p-5 ${panelClass}`}>
                <Text className={`mb-3 text-xl font-black ${titleClass}`}>Categories</Text>
                <CategorySelector selected={profile.interests} onChange={updateInterests} minSelected={5} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className={`h-[88%] overflow-hidden rounded-t-[34px] border ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
            <ProfilePanel onClose={() => setProfileOpen(false)} />
          </View>
        </View>
      </Modal>

      <BstPurchaseSheet visible={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  deckViewport: {
    overflow: 'hidden',
    position: 'relative',
    zIndex: 0,
  },
  nextCardPreview: {
    left: '4%',
    position: 'absolute',
    right: '4%',
    top: 0,
    width: '92%',
    zIndex: 0,
  },
  swiperContainer: {
    flex: 1,
    zIndex: 1,
  },
  swiperCard: {
    height: '100%',
    left: '4%',
    right: '4%',
    top: 0,
    width: '92%',
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
