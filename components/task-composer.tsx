import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

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
import { PrimaryButton } from '@/components/primary-button';
import { SelfieCheckGate } from '@/components/selfie-check-gate';
import type { Task } from '@/lib/gig-types';
import { useGigStore } from '@/lib/gig-store';
import { approximateLocationLabel } from '@/lib/geo';
import { createPersistentProfileImageRef } from '@/lib/profile-images';
import { resolveImageSource } from '@/lib/repo-images';
import { APP_NAME, BOOST_OPTIONS, CURRENCY_NAME } from '@/lib/sidehustle-config';

const defaultBoostOption = BOOST_OPTIONS[1];
const webInputReset = { boxShadow: 'none', outlineStyle: 'none' } as const;

type TaskComposerProps = {
  onClose?: () => void;
  onCreated?: () => void;
  onDeleted?: () => void;
  onSaved?: () => void;
  task?: Task | null;
};

type ComposerNotice = {
  message: string;
  onDismiss?: () => void;
  title: string;
  tone: 'error' | 'success' | 'warning';
};

export function TaskComposer({ onClose, onCreated, onDeleted, onSaved, task }: TaskComposerProps) {
  const { profile, createTask, updateTask, deleteTask, matches, isDark } = useGigStore();
  const isEditing = Boolean(task);
  const defaultLocationLabel = useMemo(
    () => fallbackLocationLabel(profile.location.latitude, profile.location.longitude),
    [profile.location.latitude, profile.location.longitude],
  );
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [budget, setBudget] = useState(task ? String(task.budget) : '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    task?.required_skills.length ? task.required_skills : task?.category ? [task.category] : [],
  );
  const [locationLabel, setLocationLabel] = useState(task?.location_label ?? defaultLocationLabel);
  const [dateWindow, setDateWindow] = useState(task?.date_window ?? '');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'open');
  const [isBoosted, setIsBoosted] = useState(task?.is_boosted ?? false);
  const [boostDays, setBoostDays] = useState(task?.boost_days || defaultBoostOption.days);
  const [imageUrls, setImageUrls] = useState<string[]>(task?.image_urls ?? []);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [composerNotice, setComposerNotice] = useState<ComposerNotice | null>(null);

  const boostCost = useMemo(
    () => (isBoosted ? getBoostCost(boostDays) : 0),
    [boostDays, isBoosted],
  );
  const boostCharge = isBoosted ? (isEditing ? Math.max(0, boostCost - (task?.boost_cost_bsts ?? 0)) : boostCost) : 0;
  const replacingWithSevenDayBoost = Boolean(isEditing && task?.is_boosted && isBoosted && boostDays === 7);
  const inputClass = (hasError = false) =>
    `rounded-[24px] border px-4 py-4 text-base ${
      hasError
        ? isDark
          ? 'border-rose-400/80 bg-rose-500/10 text-white'
          : 'border-rose-500 bg-rose-50 text-zinc-950'
        : isDark
          ? 'border-white/10 bg-white/10 text-white'
          : 'border-zinc-200 bg-zinc-100 text-zinc-950'
    }`;
  const labelClass = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const errorLabelClass = isDark ? 'text-rose-300' : 'text-rose-600';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const errorFrameClass = isDark ? 'border-rose-400/80 bg-rose-500/10' : 'border-rose-500 bg-rose-50';
  const parsedBudget = Number(budget);
  const primaryCategory = selectedCategories[0] ?? '';
  const missingTitle = !title.trim();
  const missingDescription = !description.trim();
  const missingImages = imageUrls.length === 0;
  const missingBudget = !Number.isFinite(parsedBudget) || parsedBudget < 5;
  const missingCategories = selectedCategories.length === 0;
  const missingDates = !dateWindow.trim();
  const missingFieldLabels = [
    missingTitle ? 'title' : null,
    missingDescription ? 'description' : null,
    missingImages ? 'reference image' : null,
    missingBudget ? 'budget $5+' : null,
    missingCategories ? 'category' : null,
    missingDates ? 'date range' : null,
  ].filter(Boolean);
  const canPublish = Boolean(
    !missingTitle &&
      !missingDescription &&
      !missingImages &&
      !missingBudget &&
      !missingCategories &&
      !missingDates &&
      locationLabel.trim(),
  );
  const hasCompletedMatch = Boolean(
    task && matches.some((match) => match.task.id === task.id && match.status === 'completed'),
  );
  const canDelete = Boolean(task && !hasCompletedMatch);
  const isBusy = isSubmitting || isDeleting;
  const showValidation = publishAttempted;

  useEffect(() => {
    if (!task) {
      return;
    }

    setTitle(task.title);
    setDescription(task.description);
    setBudget(String(task.budget));
    setSelectedCategories(task.required_skills.length ? task.required_skills : task.category ? [task.category] : []);
    setLocationLabel(task.location_label);
    setDateWindow(task.date_window);
    setStatus(task.status);
    setIsBoosted(task.is_boosted);
    setBoostDays(task.boost_days || defaultBoostOption.days);
    setImageUrls(task.image_urls);
    setPublishAttempted(false);
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
    if (isBusy) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showComposerNotice('Photo access needed', 'Attach at least one image for this gig.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
      base64: Platform.OS === 'web',
    });

    if (result.canceled) {
      return;
    }

    try {
      const imageRefs = await Promise.all(result.assets.map((asset) => createPersistentProfileImageRef(asset)));
      setImageUrls((current) => [...current, ...imageRefs].slice(0, 4));
    } catch {
      showComposerNotice('Photo save failed', 'Choose another image and try again.');
    }
  }

  function removeImage(uri: string) {
    if (isBusy) {
      return;
    }

    setImageUrls((current) => current.filter((item) => item !== uri));
  }

  function selectDate(day: Date) {
    if (isBusy) {
      return;
    }

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

  async function submitTask() {
    if (isBusy) {
      return;
    }

    if (!profile.is_verified) {
      setVerificationOpen(true);
      return;
    }

    if (!canPublish) {
      setPublishAttempted(true);
      showComposerNotice('Missing details', `Add: ${missingFieldLabels.join(', ')}.`, 'warning');
      return;
    }

    const input = {
      title: title.trim(),
      description: description.trim(),
      budget: parsedBudget,
      category: primaryCategory,
      requiredSkills: selectedCategories,
      location_label: locationLabel.trim(),
      date_window: dateWindow.trim(),
      is_boosted: isBoosted,
      boost_days: isBoosted ? boostDays : 0,
      boost_cost_bsts: boostCost,
      image_urls: imageUrls,
    };

    setIsSubmitting(true);

    const result = await (task
      ? updateTask(task.id, {
          ...input,
          status,
        })
      : createTask(input)).catch(() => ({
        ok: false,
        message: isEditing ? 'Gig save failed. Please try again.' : 'Gig publish failed. Please try again.',
        reason: undefined,
      }));

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.reason === 'insufficient_credits') {
        setPurchaseOpen(true);
      } else {
        showComposerNotice('Gig needs revision', result.message ?? 'Edit the gig details and try again.', 'warning');
      }
      return;
    }

    showComposerNotice(
      isEditing ? 'Gig updated' : 'Gig posted',
      isBoosted ? `Boosted for ${boostDays} day${boostDays === 1 ? '' : 's'}.` : 'Your gig is live.',
      'success',
      () => {
        onSaved?.();
        onCreated?.();
        setPublishAttempted(false);
      },
    );
  }

  function confirmDeleteTask() {
    if (!task || isBusy) {
      return;
    }

    if (!profile.is_verified) {
      setVerificationOpen(true);
      return;
    }

    if (!canDelete) {
      showComposerNotice('Gig cannot be deleted', 'Completed gigs stay in Archived.', 'warning');
      return;
    }

    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }

  async function runDeleteTask(taskId: string) {
    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteTask(taskId).catch(() => ({
      ok: false,
      message: 'Could not delete this gig. Please try again.',
    }));

    setIsDeleting(false);

    if (!result.ok) {
      setDeleteError(result.message ?? 'Could not delete this gig. Please try again.');
      return;
    }

    setDeleteConfirmOpen(false);

    if (onDeleted) {
      onDeleted();
    } else {
      onSaved?.();
    }
  }

  function showComposerNotice(
    title: string,
    message: string,
    tone: ComposerNotice['tone'] = 'error',
    onDismiss?: () => void,
  ) {
    setComposerNotice({ message, onDismiss, title, tone });
  }

  function dismissComposerNotice() {
    const onDismiss = composerNotice?.onDismiss;

    setComposerNotice(null);
    onDismiss?.();
  }

  return (
    <View className="flex-1">
      <View className={`z-10 border-b pb-4 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold text-orange-400">{APP_NAME}</Text>
            <Text className={`text-2xl font-black ${titleClass}`}>{isEditing ? 'Edit gig' : 'Create gig'}</Text>
          </View>
          {onClose ? (
            <Pressable
              accessibilityLabel="Close gig composer"
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onClose}
              className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-white'} ${isBusy ? 'opacity-60' : ''}`}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-8 pt-5" showsVerticalScrollIndicator={false}>
        {showValidation && missingFieldLabels.length > 0 ? (
          <View className={`mb-5 rounded-[24px] border p-4 ${errorFrameClass}`}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="alert-circle" size={18} color="#F43F5E" />
              <Text className={`flex-1 text-sm font-black ${errorLabelClass}`}>
                Missing: {missingFieldLabels.join(', ')}
              </Text>
            </View>
          </View>
        ) : null}

        {isEditing && (
          <Field label="Status" labelClass={labelClass}>
            <View className="flex-row gap-2">
              {(['open', 'archived'] as const).map((nextStatus) => {
                const selected = status === nextStatus;

                return (
                  <Pressable
                    key={nextStatus}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isBusy }}
                    disabled={isBusy}
                    onPress={() => setStatus(nextStatus)}
                    className={`min-h-12 flex-1 items-center justify-center rounded-full border ${
                      selected ? 'border-violet bg-violet' : softClass
                    } ${isBusy ? 'opacity-70' : ''}`}>
                    <Text className={`font-black capitalize ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}>
                      {nextStatus}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        )}

        <Field label="Title" labelClass={showValidation && missingTitle ? errorLabelClass : labelClass}>
          <TextInput
            editable={!isBusy}
            value={title}
            onChangeText={setTitle}
            placeholder="What do you need done?"
            placeholderTextColor="#71717A"
            className={`${inputClass(showValidation && missingTitle)} font-semibold ${isBusy ? 'opacity-70' : ''}`}
          />
        </Field>

        <Field label="Description" labelClass={showValidation && missingDescription ? errorLabelClass : labelClass}>
          <TextInput
            editable={!isBusy}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe the gig, timing, and constraints."
            placeholderTextColor="#71717A"
            className={`${inputClass(showValidation && missingDescription)} min-h-32 leading-6 ${isBusy ? 'opacity-70' : ''}`}
            textAlignVertical="top"
          />
        </Field>

        <Field label={`Reference images (${imageUrls.length}/4)`} labelClass={showValidation && missingImages ? errorLabelClass : labelClass}>
          <View className="gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={() => void pickImages()}
              className={`min-h-14 flex-row items-center justify-center gap-2 rounded-[24px] border ${
                showValidation && missingImages ? errorFrameClass : isDark ? 'border-orange-400/40 bg-orange-500/15' : 'border-orange-300 bg-orange-50'
              } ${isBusy ? 'opacity-70' : ''}`}>
              <Ionicons name="image" size={20} color="#F97316" />
              <Text className={`font-bold ${titleClass}`}>Attach Images</Text>
            </Pressable>

            {imageUrls.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {imageUrls.map((uri) => (
                  <ImagePreview key={uri} disabled={isBusy} uri={uri} onRemove={() => removeImage(uri)} />
                ))}
              </View>
            )}
          </View>
        </Field>

        <Field label="Budget" labelClass={showValidation && missingBudget ? errorLabelClass : labelClass}>
          <View className={`flex-row items-center rounded-[24px] border px-4 ${showValidation && missingBudget ? errorFrameClass : softClass}`}>
            <Text className={`text-xl font-black ${titleClass}`}>$</Text>
            <TextInput
              editable={!isBusy}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              className={`min-w-0 flex-1 py-4 text-xl font-black ${titleClass} ${isBusy ? 'opacity-70' : ''}`}
              style={webInputReset as never}
            />
          </View>
        </Field>

        <Field label="Boost" labelClass={labelClass}>
          <View className={`min-h-14 flex-row items-center justify-between rounded-[24px] border px-4 ${softClass} ${isBusy ? 'opacity-70' : ''}`}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="flame" size={18} color="#F97316" />
              <Text className={`text-sm font-bold ${titleClass}`}>{boostCost} {CURRENCY_NAME}</Text>
            </View>
            <Switch
              disabled={isBusy}
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
              {BOOST_OPTIONS.map((option) => {
                const selected = boostDays === option.days;

                return (
                  <Pressable
                    key={option.days}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isBusy }}
                    disabled={isBusy}
                    onPress={() => setBoostDays(option.days)}
                    className={`min-h-12 flex-1 items-center justify-center rounded-full border ${
                      selected ? 'border-orange-400 bg-orange-500' : softClass
                    } ${isBusy ? 'opacity-70' : ''}`}>
                    <Text className={`font-black ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}>
                      {option.days}d
                    </Text>
                    <Text className={`text-xs font-bold ${selected || isDark ? 'text-white/80' : mutedClass}`}>
                      {option.cost} {CURRENCY_NAME}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className={`mt-2 text-xs font-semibold ${mutedClass}`}>
              Posting is free. Boosting spends 50-100 {CURRENCY_NAME} depending on duration.
            </Text>
            {replacingWithSevenDayBoost ? (
              <View className={`mt-3 flex-row gap-2 rounded-[22px] border p-4 ${isDark ? 'border-orange-400/30 bg-orange-500/10' : 'border-orange-200 bg-orange-50'}`}>
                <Ionicons name="information-circle" size={18} color="#F97316" />
                <Text className={`flex-1 text-sm font-bold ${isDark ? 'text-orange-100' : 'text-orange-800'}`}>
                  Your current boost will be replaced by this 7-day boost.
                </Text>
              </View>
            ) : null}
            <View className={`mt-3 rounded-[22px] border p-4 ${softClass}`}>
              <Text className={`text-sm font-bold ${mutedClass}`}>BSTs available</Text>
              <Text className={`text-2xl font-black ${titleClass}`}>{profile.credits} {CURRENCY_NAME}</Text>
            </View>
          </Field>
        )}

        <Field label="Categories" labelClass={showValidation && missingCategories ? errorLabelClass : labelClass}>
          <View className={`rounded-[24px] border p-3 ${showValidation && missingCategories ? errorFrameClass : softClass}`}>
            <CategorySelector disabled={isBusy} selected={selectedCategories} onChange={setSelectedCategories} minSelected={1} />
          </View>
        </Field>

        <Field label="Start and end dates" labelClass={showValidation && missingDates ? errorLabelClass : labelClass}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={() => setCalendarOpen((current) => !current)}
            className={`min-h-14 flex-row items-center justify-between rounded-[24px] border px-4 ${
              showValidation && missingDates ? errorFrameClass : softClass
            } ${isBusy ? 'opacity-70' : ''}`}>
            <Text className={`flex-1 font-semibold ${dateWindow ? titleClass : mutedClass}`} numberOfLines={1}>
              {dateWindow || 'Choose a date range'}
            </Text>
            <Ionicons name={calendarOpen ? 'chevron-up' : 'calendar'} size={20} color="#8B5CF6" />
          </Pressable>
          {calendarOpen ? (
            <CalendarRangePicker
              disabled={isBusy}
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

        {isEditing ? (
          <>
            <View className="flex-row gap-3">
              <PrimaryButton
                label={isDeleting ? 'Deleting...' : 'Delete Gig'}
                icon="trash"
                tone="danger"
                disabled={isBusy || !canDelete}
                loading={isDeleting}
                onPress={confirmDeleteTask}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={isSubmitting ? 'Saving...' : 'Save Gig'}
                icon="save"
                disabled={isBusy}
                loading={isSubmitting}
                onPress={() => void submitTask()}
                visuallyDisabled={!canPublish}
                style={{ flex: 1 }}
              />
            </View>
            {!canDelete ? (
              <Text className={`mt-2 text-center text-xs font-semibold ${mutedClass}`}>
                Completed gigs stay in Archived.
              </Text>
            ) : null}
          </>
        ) : (
          <PrimaryButton
            label={isSubmitting ? 'Publishing...' : 'Publish Gig'}
            icon="rocket"
            disabled={isBusy}
            loading={isSubmitting}
            onPress={() => void submitTask()}
            visuallyDisabled={!canPublish}
          />
        )}
      </ScrollView>

      <BstPurchaseSheet
        visible={purchaseOpen}
        reason={`You don't have enough ${CURRENCY_NAME} for this boost. You need ${boostCharge || boostCost} ${CURRENCY_NAME} to continue.`}
        onClose={() => setPurchaseOpen(false)}
      />
      <SelfieCheckGate visible={verificationOpen} onClose={() => setVerificationOpen(false)} />
      {deleteConfirmOpen ? (
        <View className="absolute inset-0 z-50 justify-center bg-black/70 px-4">
          <View className={`rounded-[30px] border p-5 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
            <View className="mb-4 flex-row items-start gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-rose-500/15">
                <Ionicons name="trash" size={21} color="#F43F5E" />
              </View>
              <View className="flex-1">
                <Text className={`text-xl font-black ${titleClass}`}>Delete this gig?</Text>
                <Text className={`mt-1 text-sm leading-5 ${mutedClass}`}>
                  This removes the gig from GigHub and the swipe feed. This cannot be undone.
                </Text>
              </View>
            </View>
            {deleteError ? (
              <View className={`mb-4 rounded-[20px] border p-3 ${isDark ? 'border-rose-400/40 bg-rose-500/10' : 'border-rose-200 bg-rose-50'}`}>
                <Text className={`text-sm font-bold ${isDark ? 'text-rose-200' : 'text-rose-700'}`}>{deleteError}</Text>
              </View>
            ) : null}
            <View className="flex-row gap-3">
              <PrimaryButton
                label="Cancel"
                icon="close"
                tone="ghost"
                disabled={isDeleting}
                onPress={() => setDeleteConfirmOpen(false)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={isDeleting ? 'Deleting...' : 'Delete'}
                icon="trash"
                tone="danger"
                disabled={isDeleting}
                loading={isDeleting}
                onPress={() => {
                  if (task) {
                    void runDeleteTask(task.id);
                  }
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      ) : null}
      {composerNotice ? (
        <ComposerNoticeOverlay notice={composerNotice} onDismiss={dismissComposerNotice} />
      ) : null}
    </View>
  );
}

function ComposerNoticeOverlay({ notice, onDismiss }: { notice: ComposerNotice; onDismiss: () => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-300' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const success = notice.tone === 'success';
  const warning = notice.tone === 'warning';
  const icon = success ? 'checkmark' : warning ? 'alert-circle' : 'alert';
  const iconClass = success ? 'bg-emerald-500' : warning ? 'bg-orange-500' : 'bg-rose-500';
  const buttonTone = success ? 'emerald' : warning ? 'orange' : 'violet';

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/75 px-4">
      <View className={`w-full rounded-[30px] border p-5 ${panelClass}`}>
        <View className={`mb-4 h-14 w-14 items-center justify-center rounded-full ${iconClass}`}>
          <Ionicons name={icon} size={26} color="#FFFFFF" />
        </View>
        <Text className={`text-2xl font-black ${titleClass}`}>{notice.title}</Text>
        <Text className={`mt-3 text-base leading-6 ${mutedClass}`}>{notice.message}</Text>
        <PrimaryButton label="OK" icon="checkmark" tone={buttonTone} onPress={onDismiss} style={{ marginTop: 24 }} />
      </View>
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

function ImagePreview({ disabled = false, onRemove, uri }: { disabled?: boolean; onRemove: () => void; uri: string }) {
  const imageSource = resolveImageSource(uri);

  return (
    <View className="relative h-[76px] w-[76px] overflow-hidden rounded-[18px] bg-zinc-800">
      {imageSource ? (
        <Image source={imageSource} style={{ height: 76, width: 76 }} contentFit="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center bg-violet/20">
          <Ionicons name="image" size={22} color="#C4B5FD" />
        </View>
      )}
      <Pressable
        accessibilityLabel="Remove image"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onRemove}
        className={`absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/70 ${disabled ? 'opacity-60' : ''}`}>
        <Ionicons name="close" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function fallbackLocationLabel(latitude: number, longitude: number) {
  return approximateLocationLabel({ latitude, longitude });
}

function getBoostCost(days: number) {
  return BOOST_OPTIONS.find((option) => option.days === days)?.cost ?? defaultBoostOption.cost;
}

function formatGeocodedLabel(place: Location.LocationGeocodedAddress) {
  const parts = [place.district, place.city, place.region].filter(Boolean);
  const uniqueParts = parts.filter((part, index) => parts.indexOf(part) === index);
  return uniqueParts.slice(0, 2).join(', ');
}
