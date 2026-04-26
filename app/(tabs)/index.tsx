import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type PanResponderGestureState,
} from 'react-native';
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
import { SelfieCheckGate } from '@/components/selfie-check-gate';
import { TaskCard } from '@/components/task-card';
import { useGigStore } from '@/lib/gig-store';
import type { Task } from '@/lib/gig-types';
import { APP_NAME } from '@/lib/sidehustle-config';

const QUICK_BID = 'I can help you with this!';
const webInputReset = { boxShadow: 'none', outlineStyle: 'none' } as const;
const SWIPE_ACTIVATION_DISTANCE = 14;
const SWIPE_DIRECTION_LOCK_RATIO = 1.15;
const SWIPE_COMPLETION_DISTANCE = 100;
const SWIPE_COMPLETION_VELOCITY = 0.65;
const SWIPE_OVERLAY_DISTANCE = 42;
const SWIPE_OUT_DURATION_MS = 210;

type SwipeIntent = 'left' | 'right' | null;

function isHorizontalSwipeGesture(gestureState: PanResponderGestureState) {
  const horizontalDistance = Math.abs(gestureState.dx);
  const verticalDistance = Math.abs(gestureState.dy);

  return (
    horizontalDistance > SWIPE_ACTIVATION_DISTANCE &&
    horizontalDistance > verticalDistance * SWIPE_DIRECTION_LOCK_RATIO
  );
}

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
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const swipeIntentRef = useRef<SwipeIntent>(null);
  const swipingLockedRef = useRef(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [swipeIntent, setSwipeIntent] = useState<SwipeIntent>(null);
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
  const [verificationOpen, setVerificationOpen] = useState(false);
  const { width } = useWindowDimensions();

  const postersById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const panelClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white';
  const deckSignature = useMemo(() => deck.map((task) => task.id).join('|'), [deck]);
  const hasVisibleCard = activeCardIndex < deck.length;
  const activeTask = hasVisibleCard ? deck[activeCardIndex] ?? null : null;
  const activePoster = activeTask ? postersById.get(activeTask.poster_id) ?? profile : null;
  const nextPreviewTask = hasVisibleCard ? deck[activeCardIndex + 1] ?? null : null;
  const nextPreviewPoster = nextPreviewTask ? postersById.get(nextPreviewTask.poster_id) ?? profile : null;
  const compactHeader = width < 390;
  const deckBottomPadding = 20;
  const emptyTitle = deck.length === 0 ? 'No gigs in range' : "You're all caught up";
  const emptyMessage =
    deck.length === 0 ? 'Adjust proximity or categories to open up the deck.' : 'Check back soon or widen your filters for more gigs.';

  const resetSwipePosition = useCallback(
    (animated = true) => {
      swipeIntentRef.current = null;
      swipingLockedRef.current = false;
      setSwipeIntent(null);

      if (!animated) {
        swipeTranslateX.stopAnimation();
        swipeTranslateX.setValue(0);
        return;
      }

      Animated.spring(swipeTranslateX, {
        friction: 7,
        tension: 70,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
    [swipeTranslateX],
  );

  const updateSwipeIntent = useCallback((offsetX: number) => {
    const nextIntent = offsetX > SWIPE_OVERLAY_DISTANCE ? 'right' : offsetX < -SWIPE_OVERLAY_DISTANCE ? 'left' : null;

    if (swipeIntentRef.current !== nextIntent) {
      swipeIntentRef.current = nextIntent;
      setSwipeIntent(nextIntent);
    }
  }, []);

  const onSwipedRight = useCallback((cardIndex: number) => {
    const task = deck[cardIndex];

    if (!task) {
      return;
    }

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
  }, [deck]);

  const onSwipedLeft = useCallback((cardIndex: number) => {
    const task = deck[cardIndex];

    if (task) {
      rememberSwipedTask(task.id);
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [deck, rememberSwipedTask]);

  const finishSwipe = useCallback(
    (direction: Exclude<SwipeIntent, null>, cardIndex: number) => {
      if (direction === 'right') {
        onSwipedRight(cardIndex);
      } else {
        onSwipedLeft(cardIndex);
      }

      setActiveCardIndex(cardIndex + 1);
    },
    [onSwipedLeft, onSwipedRight],
  );

  const animateSwipe = useCallback(
    (direction: Exclude<SwipeIntent, null>, cardIndex = activeCardIndex) => {
      if (swipingLockedRef.current || cardIndex >= deck.length) {
        return;
      }

      swipingLockedRef.current = true;
      swipeIntentRef.current = direction;
      setSwipeIntent(direction);

      Animated.timing(swipeTranslateX, {
        duration: SWIPE_OUT_DURATION_MS,
        toValue: direction === 'right' ? width + 180 : -width - 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        swipeTranslateX.setValue(0);
        swipeIntentRef.current = null;
        swipingLockedRef.current = false;
        setSwipeIntent(null);

        if (finished) {
          finishSwipe(direction, cardIndex);
        }
      });
    },
    [activeCardIndex, deck.length, finishSwipe, swipeTranslateX, width],
  );

  const swipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) => isHorizontalSwipeGesture(gestureState),
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => isHorizontalSwipeGesture(gestureState),
        onPanResponderGrant: () => {
          swipeTranslateX.stopAnimation();
          swipeTranslateX.setValue(0);
        },
        onPanResponderMove: (_event, gestureState) => {
          swipeTranslateX.setValue(gestureState.dx);
          updateSwipeIntent(gestureState.dx);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const direction = gestureState.dx >= 0 ? 'right' : 'left';
          const shouldComplete =
            Math.abs(gestureState.dx) > SWIPE_COMPLETION_DISTANCE ||
            Math.abs(gestureState.vx) > SWIPE_COMPLETION_VELOCITY;

          if (shouldComplete) {
            animateSwipe(direction);
          } else {
            resetSwipePosition();
          }
        },
        onPanResponderTerminate: () => resetSwipePosition(),
        onShouldBlockNativeResponder: () => false,
      }),
    [animateSwipe, resetSwipePosition, swipeTranslateX, updateSwipeIntent],
  );

  const activeCardTransform = {
    transform: [
      { translateX: swipeTranslateX },
      {
        rotate: swipeTranslateX.interpolate({
          extrapolate: 'clamp',
          inputRange: [-width, 0, width],
          outputRange: ['-8deg', '0deg', '8deg'],
        }),
      },
    ],
  };

  useEffect(() => {
    resetSwipePosition(false);
    setActiveCardIndex(0);
  }, [deckSignature, resetSwipePosition]);

  const handlePass = useCallback(() => {
    if (!hasVisibleCard) {
      return;
    }

    void Haptics.selectionAsync();
    animateSwipe('left');
  }, [animateSwipe, hasVisibleCard]);

  const handleBid = useCallback(() => {
    if (!hasVisibleCard) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateSwipe('right');
  }, [animateSwipe, hasVisibleCard]);

  function closeBidSheet() {
    const restoreIndex =
      selectedTaskIndex !== null && deck[selectedTaskIndex]?.id === selectedTask?.id
        ? selectedTaskIndex
        : deck.findIndex((task) => task.id === selectedTask?.id);

    setSelectedTask(null);
    setSelectedTaskIndex(null);

    if (restoreIndex >= 0) {
      setActiveCardIndex(restoreIndex);
      resetSwipePosition(false);
    }
  }

  async function submitCounterBid() {
    if (!selectedTask) {
      return;
    }

    if (!profile.is_verified) {
      setVerificationOpen(true);
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
        resetSwipePosition(false);
        setSelectedTask(null);
        setSelectedTaskIndex(null);
        setProfileOpen(false);
        setSettingsOpen(false);
        setPurchaseOpen(false);
        setVerificationOpen(false);
      };
    }, [resetSwipePosition]),
  );

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <View className="flex-1">
        <View className={`z-20 px-5 pb-3 pt-2 ${shellClass}`}>
          <View className={`${compactHeader ? 'gap-3' : 'flex-row items-center justify-between gap-3'}`}>
            <View className={`min-w-0 ${compactHeader ? '' : 'flex-1'}`}>
              <Text className="text-xs font-semibold text-orange-400">{APP_NAME}</Text>
              <Text className={`text-2xl font-black ${titleClass}`} numberOfLines={1}>
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

        <View
          className={compactHeader ? 'mt-4 flex-1 px-3' : 'mt-4 flex-1 px-6'}
          style={[styles.deckViewport, { paddingBottom: deckBottomPadding }]}>
          {hasVisibleCard && activeTask && activePoster ? (
            <>
              {nextPreviewTask && nextPreviewPoster ? (
                <View pointerEvents="none" style={[styles.nextCardPreview, { bottom: deckBottomPadding }]}>
                  <TaskCard
                    task={nextPreviewTask}
                    poster={nextPreviewPoster}
                    scrollEnabled={false}
                    onPass={handlePass}
                    onBid={handleBid}
                  />
                </View>
              ) : null}
              <Animated.View
                {...swipePanResponder.panHandlers}
                style={[styles.activeSwipeCard, { bottom: deckBottomPadding }, activeCardTransform]}>
                {swipeIntent ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.swipeOverlay,
                      swipeIntent === 'left' ? styles.leftOverlay : styles.rightOverlay,
                    ]}>
                    <Text style={swipeIntent === 'left' ? styles.passLabel : styles.bidLabel}>
                      {swipeIntent === 'left' ? 'PASS' : 'BID'}
                    </Text>
                  </View>
                ) : null}
                <TaskCard task={activeTask} poster={activePoster} onPass={handlePass} onBid={handleBid} />
              </Animated.View>
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
            <Text className="mb-1 text-xs font-bold text-orange-400">{APP_NAME}</Text>
            <Text className={`mb-1 text-2xl font-black ${titleClass}`}>{selectedTask?.title}</Text>
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
                <Text className="text-xs font-bold text-orange-400">{APP_NAME}</Text>
                <Text className={`text-2xl font-black ${titleClass}`}>Tune gigs</Text>
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
      <SelfieCheckGate visible={verificationOpen} onClose={() => setVerificationOpen(false)} />
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
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 0,
  },
  activeSwipeCard: {
    bottom: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
  },
  swipeOverlay: {
    backgroundColor: 'transparent',
    bottom: 0,
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 5,
  },
  leftOverlay: {
    alignItems: 'flex-end',
  },
  rightOverlay: {
    alignItems: 'flex-start',
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
