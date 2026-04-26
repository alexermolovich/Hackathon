import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CategorySelector } from '@/components/category-selector';
import { PrimaryButton } from '@/components/primary-button';
import type { Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { resolveImageSource } from '@/lib/repo-images';
import { BOOST_COST_PER_DAY_BSTS, CURRENCY_NAME } from '@/lib/sidehustle-config';

const boostDurations = [1, 3, 7];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type TaskComposerProps = {
  onClose?: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
  task?: Task | null;
};

export function TaskComposer({ onClose, onCreated, onSaved, task }: TaskComposerProps) {
  const { profile, createTask, updateTask, isDark } = useGigStore();
  const isEditing = Boolean(task);
  const defaultLocationLabel = useMemo(
    () => fallbackLocationLabel(profile.location.latitude, profile.location.longitude),
    [profile.location.latitude, profile.location.longitude],
  );
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [budget, setBudget] = useState(task ? String(task.budget) : '');
  const [category, setCategory] = useState(task?.category ?? '');
  const [locationLabel, setLocationLabel] = useState(task?.location_label ?? defaultLocationLabel);
  const [dateWindow, setDateWindow] = useState(task?.date_window ?? '');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'open');
  const [isBoosted, setIsBoosted] = useState(task?.is_boosted ?? false);
  const [boostDays, setBoostDays] = useState(task?.boost_days || 3);
  const [imageUrls, setImageUrls] = useState<string[]>(task?.image_urls ?? []);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const boostCost = useMemo(
    () => (isBoosted ? boostDays * BOOST_COST_PER_DAY_BSTS : 0),
    [boostDays, isBoosted],
  );
  const inputClass = `rounded-[24px] border px-4 py-4 text-base ${
    isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
  }`;
  const labelClass = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const parsedBudget = Number(budget);
  const canPublish = Boolean(
    title.trim() &&
      description.trim() &&
      category &&
      locationLabel.trim() &&
      Number.isFinite(parsedBudget) &&
      parsedBudget >= 5 &&
      imageUrls.length > 0,
  );

  useEffect(() => {
    if (!task) {
      return;
    }

    setTitle(task.title);
    setDescription(task.description);
    setBudget(String(task.budget));
    setCategory(task.category);
    setLocationLabel(task.location_label);
    setDateWindow(task.date_window);
    setStatus(task.status);
    setIsBoosted(task.is_boosted);
    setBoostDays(task.boost_days || 3);
    setImageUrls(task.image_urls);
  }, [task]);

  useEffect(() => {
    if (task) {
      return;
    }

    let active = true;
    setLocationLabel(defaultLocationLabel);

    void Location.reverseGeocodeAsync(profile.location)
      .then((results) => {
        if (!active || !results[0]) {
          return;
        }

        const nextLabel = formatGeocodedLabel(results[0]);

        if (nextLabel) {
          setLocationLabel(nextLabel);
        }
      })
      .catch(() => {
        // The coordinate fallback is enough for posting if reverse geocoding is unavailable.
      });

    return () => {
      active = false;
    };
  }, [defaultLocationLabel, profile.location, task]);

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Attach at least one image for this gig.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    setImageUrls((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 4));
  }

  function removeImage(uri: string) {
    setImageUrls((current) => current.filter((item) => item !== uri));
  }

  function selectDate(day: Date) {
    const selected = startOfDay(day);

    if (!rangeStart || rangeEnd) {
      setRangeStart(selected);
      setRangeEnd(null);
      setDateWindow(formatDateLabel(selected));
      return;
    }

    if (selected.getTime() < rangeStart.getTime()) {
      setRangeStart(selected);
      setRangeEnd(null);
      setDateWindow(formatDateLabel(selected));
      return;
    }

    setRangeEnd(selected);
    setDateWindow(formatDateRange(rangeStart, selected));
  }

  function updateCategorySelection(selected: string[]) {
    setCategory(selected[selected.length - 1] ?? '');
  }

  async function submitTask() {
    if (!canPublish) {
      Alert.alert('Missing details', 'Add a title, description, category, image, and realistic budget.');
      return;
    }

    const input = {
      title: title.trim(),
      description: description.trim(),
      budget: parsedBudget,
      category,
      location_label: locationLabel.trim(),
      date_window: dateWindow.trim(),
      is_boosted: isBoosted,
      boost_days: isBoosted ? boostDays : 0,
      boost_cost_bsts: boostCost,
      image_urls: imageUrls,
    };

    const saved = task
      ? await updateTask(task.id, {
          ...input,
          status,
        })
      : await createTask(input);

    if (!saved) {
      setPurchaseOpen(true);
      return;
    }

    Alert.alert(
      isEditing ? 'Gig updated' : 'Gig posted',
      isBoosted ? `Boosted for ${boostDays} day${boostDays === 1 ? '' : 's'}.` : 'Your gig is live.',
    );
    onSaved?.();
    onCreated?.();
  }

  return (
    <>
      <View className={`z-10 border-b pb-4 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-orange-400">Gig starter mode</Text>
            <Text className={`text-3xl font-black ${titleClass}`}>{isEditing ? 'Edit gig' : 'Post a gig'}</Text>
          </View>
          {onClose ? (
            <Pressable
              accessibilityLabel="Close gig composer"
              accessibilityRole="button"
              onPress={onClose}
              className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-white'}`}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-8 pt-5" showsVerticalScrollIndicator={false}>
        {isEditing && (
          <Field label="Status" labelClass={labelClass}>
            <View className="flex-row gap-2">
              {(['open', 'archived'] as const).map((nextStatus) => {
                const selected = status === nextStatus;

                return (
                  <Pressable
                    key={nextStatus}
                    accessibilityRole="button"
                    onPress={() => setStatus(nextStatus)}
                    className={`min-h-12 flex-1 items-center justify-center rounded-full border ${
                      selected ? 'border-violet bg-violet' : softClass
                    }`}>
                    <Text className={`font-black capitalize ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}>
                      {nextStatus}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        )}

        <Field label="Title" labelClass={labelClass}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What do you need done?"
            placeholderTextColor="#71717A"
            className={`${inputClass} font-semibold`}
          />
        </Field>

        <Field label="Description" labelClass={labelClass}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe the gig, timing, and constraints."
            placeholderTextColor="#71717A"
            className={`${inputClass} min-h-32 leading-6`}
            textAlignVertical="top"
          />
        </Field>

        <Field label={`Reference images (${imageUrls.length}/4)`} labelClass={labelClass}>
          <View className="gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => void pickImages()}
              className={`min-h-14 flex-row items-center justify-center gap-2 rounded-[24px] border ${
                isDark ? 'border-orange-400/40 bg-orange-500/15' : 'border-orange-300 bg-orange-50'
              }`}>
              <Ionicons name="image" size={20} color="#F97316" />
              <Text className={`font-bold ${titleClass}`}>Attach Images</Text>
            </Pressable>

            {imageUrls.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {imageUrls.map((uri) => (
                  <View key={uri} className="relative overflow-hidden rounded-[18px]">
                    <Image source={resolveImageSource(uri)} style={{ height: 76, width: 76 }} contentFit="cover" />
                    <Pressable
                      accessibilityLabel="Remove image"
                      accessibilityRole="button"
                      onPress={() => removeImage(uri)}
                      className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/70">
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Field>

        <Field label="Budget" labelClass={labelClass}>
          <View className={`flex-row items-center rounded-[24px] border px-4 ${softClass}`}>
            <Text className={`text-xl font-black ${titleClass}`}>$</Text>
            <TextInput
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              className={`min-w-0 flex-1 py-4 text-xl font-black ${titleClass}`}
            />
          </View>
        </Field>

        <Field label="Boost" labelClass={labelClass}>
          <View className={`min-h-14 flex-row items-center justify-between rounded-[24px] border px-4 ${softClass}`}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="flame" size={18} color="#F97316" />
              <Text className={`text-sm font-bold ${titleClass}`}>{boostCost} {CURRENCY_NAME}</Text>
            </View>
            <Switch
              value={isBoosted}
              onValueChange={setIsBoosted}
              thumbColor="#FFFFFF"
              trackColor={{ false: '#A1A1AA', true: '#F97316' }}
            />
          </View>
        </Field>

        {isBoosted && (
          <Field label="Boost duration" labelClass={labelClass}>
            <View className="flex-row gap-2">
              {boostDurations.map((days) => {
                const selected = boostDays === days;

                return (
                  <Pressable
                    key={days}
                    accessibilityRole="button"
                    onPress={() => setBoostDays(days)}
                    className={`min-h-12 flex-1 items-center justify-center rounded-full border ${
                      selected ? 'border-orange-400 bg-orange-500' : softClass
                    }`}>
                    <Text className={`font-black ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}>
                      {days}d
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className={`mt-2 text-xs font-semibold ${mutedClass}`}>
              Posting is free. Boosting spends {BOOST_COST_PER_DAY_BSTS} {CURRENCY_NAME} per day.
            </Text>
            <View className={`mt-3 rounded-[22px] border p-4 ${softClass}`}>
              <Text className={`text-sm font-bold ${mutedClass}`}>BSTs available</Text>
              <Text className={`text-2xl font-black ${titleClass}`}>{profile.credits} {CURRENCY_NAME}</Text>
            </View>
          </Field>
        )}

        <Field label="Category" labelClass={labelClass}>
          <CategorySelector selected={category ? [category] : []} onChange={updateCategorySelection} minSelected={1} />
        </Field>

        <Field label="Start and end dates" labelClass={labelClass}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCalendarOpen((current) => !current)}
            className={`min-h-14 flex-row items-center justify-between rounded-[24px] border px-4 ${softClass}`}>
            <Text className={`flex-1 font-semibold ${dateWindow ? titleClass : mutedClass}`} numberOfLines={1}>
              {dateWindow || 'Choose a date range'}
            </Text>
            <Ionicons name={calendarOpen ? 'chevron-up' : 'calendar'} size={20} color="#8B5CF6" />
          </Pressable>
          {calendarOpen ? (
            <CalendarRangePicker
              isDark={isDark}
              onChangeMonth={(offset) => setVisibleMonth((current) => addMonths(current, offset))}
              onDone={() => setCalendarOpen(false)}
              onSelect={selectDate}
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              visibleMonth={visibleMonth}
            />
          ) : null}
        </Field>

        <PrimaryButton
          label={isEditing ? 'Save Gig' : 'Publish Gig'}
          icon={isEditing ? 'save' : 'rocket'}
          onPress={() => void submitTask()}
          disabled={!canPublish}
        />
      </ScrollView>

      <BstPurchaseSheet
        visible={purchaseOpen}
        reason={`Boosting this gig needs ${boostCost} ${CURRENCY_NAME}.`}
        onClose={() => setPurchaseOpen(false)}
      />
    </>
  );
}

function CalendarRangePicker({
  isDark,
  onChangeMonth,
  onDone,
  onSelect,
  rangeEnd,
  rangeStart,
  visibleMonth,
}: {
  isDark: boolean;
  onChangeMonth: (offset: number) => void;
  onDone: () => void;
  onSelect: (day: Date) => void;
  rangeEnd: Date | null;
  rangeStart: Date | null;
  visibleMonth: Date;
}) {
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const cells = buildCalendarCells(visibleMonth);

  return (
    <View className={`mt-3 rounded-[26px] border p-4 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={() => onChangeMonth(-1)}
          className={`h-10 w-10 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
          <Ionicons name="chevron-back" size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
        </Pressable>
        <Text className={`text-lg font-black ${titleClass}`}>
          {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChangeMonth(1)}
          className={`h-10 w-10 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
        </Pressable>
      </View>

      <View className="mb-2 flex-row">
        {weekdayLabels.map((label, index) => (
          <Text key={`${label}-${index}`} className={`flex-1 text-center text-xs font-black ${mutedClass}`}>
            {label}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, index) => {
          if (!day) {
            return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          }

          const selected = sameDay(day, rangeStart) || sameDay(day, rangeEnd);
          const inRange = isInRange(day, rangeStart, rangeEnd);

          return (
            <View key={day.toISOString()} className="p-0.5" style={{ width: `${100 / 7}%`, aspectRatio: 1 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelect(day)}
                className={`h-full items-center justify-center rounded-2xl ${
                  selected ? 'bg-violet' : inRange ? 'bg-violet/20' : isDark ? 'bg-white/5' : 'bg-zinc-100'
                }`}>
                <Text className={`font-black ${selected ? 'text-white' : titleClass}`}>{day.getDate()}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text className={`mt-3 text-center text-xs font-semibold ${mutedClass}`}>
        {rangeStart && rangeEnd
          ? `${durationDays(rangeStart, rangeEnd)} day${durationDays(rangeStart, rangeEnd) === 1 ? '' : 's'} selected`
          : rangeStart
            ? 'Choose an end date'
            : 'Choose a start date'}
      </Text>
      {rangeStart && rangeEnd ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDone}
          className="mt-3 min-h-11 items-center justify-center rounded-full bg-violet px-5">
          <Text className="text-sm font-black text-white">Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({
  label,
  labelClass,
  children,
}: {
  label: string;
  labelClass: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-5">
      <Text className={`mb-2 text-sm font-bold ${labelClass}`}>{label}</Text>
      {children}
    </View>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function buildCalendarCells(month: Date) {
  const firstDay = startOfMonth(month);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstDay.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function sameDay(left: Date | null, right: Date | null) {
  return Boolean(
    left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );
}

function isInRange(day: Date, start: Date | null, end: Date | null) {
  return Boolean(start && end && day.getTime() > start.getTime() && day.getTime() < end.getTime());
}

function durationDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function formatDateLabel(date: Date) {
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

function formatDateRange(start: Date, end: Date) {
  const suffix = start.getFullYear() === end.getFullYear() ? '' : `, ${end.getFullYear()}`;
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}${suffix}`;
}

function fallbackLocationLabel(latitude: number, longitude: number) {
  return `Near ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

function formatGeocodedLabel(place: Location.LocationGeocodedAddress) {
  const parts = [place.district, place.city, place.region].filter(Boolean);
  const uniqueParts = parts.filter((part, index) => parts.indexOf(part) === index);
  return uniqueParts.slice(0, 2).join(', ');
}
