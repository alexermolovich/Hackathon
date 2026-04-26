import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CategorySelector } from '@/components/category-selector';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { useGigStore } from '@/lib/gig-store';
import { calculateAge, initials } from '@/lib/gig-utils';
import { createPersistentProfileImageRef, PROFILE_IMAGE_PICKER_OPTIONS } from '@/lib/profile-images';
import { formatVisibleRating } from '@/lib/rating-utils';
import { resolveImageSource } from '@/lib/repo-images';
import { CURRENCY_NAME } from '@/lib/sidehustle-config';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type ProfilePanelProps = {
  onClose?: () => void;
};

type ProfileDraft = {
  avatarUrl: string | null;
  bio: string;
  birthDate: string;
  educationLevel: string;
  interests: string[];
  isVerified: boolean;
  phoneNumber: string;
  phoneVerified: boolean;
  username: string;
};

function buildDraft(profile: ReturnType<typeof useGigStore>['profile']): ProfileDraft {
  return {
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    birthDate: profile.birth_date,
    educationLevel: profile.education_level ?? '',
    interests: profile.interests,
    isVerified: profile.is_verified,
    phoneNumber: profile.phone_number,
    phoneVerified: profile.phone_verified,
    username: profile.username,
  };
}

export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const {
    profile,
    updateProfileDetails,
    isDark,
    colorMode,
    toggleColorMode,
    logout,
  } = useGigStore();
  const [isEditing, setIsEditing] = useState(false);
  const [birthCalendarOpen, setBirthCalendarOpen] = useState(false);
  const [birthVisibleMonth, setBirthVisibleMonth] = useState(() => startOfMonth(parseProfileDate(profile.birth_date) ?? new Date(2000, 0, 1)));
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => buildDraft(profile));
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const age = calculateAge(draft.birthDate);
  const savedDraft = useMemo(() => buildDraft(profile), [profile]);
  const draftAvatarSource = resolveImageSource(draft.avatarUrl);
  const hasChanges = useMemo(
    () =>
      draft.avatarUrl !== savedDraft.avatarUrl ||
      draft.bio !== savedDraft.bio ||
      draft.birthDate !== savedDraft.birthDate ||
      draft.educationLevel !== savedDraft.educationLevel ||
      draft.phoneNumber !== savedDraft.phoneNumber ||
      draft.phoneVerified !== savedDraft.phoneVerified ||
      draft.username !== savedDraft.username ||
      draft.isVerified !== savedDraft.isVerified ||
      draft.interests.join('|') !== savedDraft.interests.join('|'),
    [draft, savedDraft],
  );

  useEffect(() => {
    if (!isEditing) {
      setDraft(buildDraft(profile));
      setBirthCalendarOpen(false);
    }
  }, [isEditing, profile]);

  function resetDraft() {
    setDraft(buildDraft(profile));
    setIsEditing(false);
  }

  async function saveDraft() {
    const username = draft.username.trim() || profile.username || 'SideHustler';
    const educationLevel = draft.educationLevel.trim();

    try {
      await updateProfileDetails({
        avatar_url: draft.avatarUrl,
        bio: draft.bio.trim(),
        birth_date: draft.birthDate.trim(),
        education_level: educationLevel || null,
        interests: draft.interests,
        is_verified: draft.isVerified,
        phone_number: draft.phoneNumber.trim(),
        phone_verified: draft.phoneVerified,
        skills: draft.interests,
        username,
      });
      setDraft((current) => ({ ...current, educationLevel, username }));
      setIsEditing(false);
    } catch {
      Alert.alert('Profile update failed', 'Please try again.');
    }
  }

  async function runPhotoEdit() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Choose an image to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(PROFILE_IMAGE_PICKER_OPTIONS);

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    try {
      const avatarUrl = await createPersistentProfileImageRef(result.assets[0]);
      setDraft((current) => ({ ...current, avatarUrl, isVerified: true }));
    } catch {
      Alert.alert('Photo save failed', 'Choose another image and try again.');
    }
  }

  function updatePhoneNumber(phoneNumber: string) {
    setDraft((current) => ({
      ...current,
      phoneNumber,
      phoneVerified: phoneNumber.trim() === savedDraft.phoneNumber.trim() ? savedDraft.phoneVerified : false,
    }));
  }

  function selectBirthDate(date: Date) {
    setDraft((current) => ({ ...current, birthDate: formatProfileDate(date) }));
    setBirthCalendarOpen(false);
  }

  return (
    <View className="flex-1">
      <View className={`z-10 flex-row items-center justify-between border-b px-5 pb-4 pt-5 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
        <View>
          <Text className="text-sm font-semibold text-orange-400">Account hub</Text>
          <Text className={`text-3xl font-black ${titleClass}`}>Profile</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <CreditBadge credits={profile.credits} onPress={() => setPurchaseOpen(true)} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (isEditing && !hasChanges) {
                setIsEditing(false);
                return;
              }

              setIsEditing(true);
            }}
            className={`h-11 flex-row items-center justify-center gap-1 rounded-full px-4 ${
              isEditing ? 'bg-violet' : isDark ? 'bg-white/10' : 'bg-white'
            }`}>
            <Ionicons name="create" size={17} color={isEditing ? '#FFFFFF' : isDark ? '#FFFFFF' : '#18181B'} />
            <Text className={`text-sm font-black ${isEditing || isDark ? 'text-white' : 'text-zinc-950'}`}>
              {isEditing ? 'Editing' : 'Edit'}
            </Text>
          </Pressable>
          {onClose ? (
            <Pressable
              accessibilityLabel="Close profile"
              accessibilityRole="button"
              onPress={onClose}
              className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-white'}`}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {hasChanges ? (
        <View className={`z-10 flex-row gap-3 border-b px-5 py-3 ${isDark ? 'border-white/10 bg-black' : 'border-zinc-200 bg-zinc-100'}`}>
          <PrimaryButton label="Cancel" icon="close" tone="ghost" onPress={resetDraft} style={{ flex: 1 }} />
          <PrimaryButton label="Save" icon="checkmark" tone="emerald" onPress={() => void saveDraft()} style={{ flex: 1 }} />
        </View>
      ) : null}

      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8 pt-5" showsVerticalScrollIndicator={false}>
        <View className={`mb-5 rounded-[32px] border p-5 ${panelClass}`}>
          <View className="mb-5 flex-row items-center gap-4">
            <View className="relative h-24 w-24">
              <Pressable
                accessibilityLabel="Change profile photo"
                accessibilityRole="button"
                disabled={!isEditing}
                onPress={() => void runPhotoEdit()}
                className={`h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-orange-400/30 bg-orange-500/15 ${
                  isEditing ? '' : 'opacity-80'
                }`}>
                {draftAvatarSource ? (
                  <Image source={draftAvatarSource} style={{ height: 96, width: 96 }} contentFit="cover" />
                ) : (
                  <Text className="text-3xl font-black text-white">{initials(draft.username)}</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityLabel="Edit profile image"
                accessibilityRole="button"
                disabled={!isEditing}
                onPress={() => void runPhotoEdit()}
                className={`absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-violet ${
                  isEditing ? '' : 'opacity-50'
                }`}>
                <Ionicons name="create" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
            <View className="flex-1">
              <View className="mb-2 flex-row items-center gap-2">
                <Text className={`text-sm font-bold ${mutedClass}`}>Name</Text>
                <VerifiedBadge verified={draft.isVerified} compact />
              </View>
              <TextInput
                editable={isEditing}
                value={draft.username}
                onChangeText={(username) => setDraft((current) => ({ ...current, username }))}
                placeholder="Your name"
                placeholderTextColor="#71717A"
                className={`min-h-12 rounded-2xl border px-3 text-xl font-black ${
                  isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
                }`}
              />
            </View>
          </View>

          <View className="flex-row gap-2">
            <TrustPanel icon="medal" label="Hustles Completed" value={profile.vouch_count.toString()} />
            <TrustPanel icon="star" label="Avg Rating" value={formatVisibleRating(profile, 'any')} />
            <TrustPanel icon="briefcase" label="Posted Gigs" value={profile.posted_vouch_count.toString()} />
          </View>
        </View>

        <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
          <Text className={`mb-3 text-xl font-black ${titleClass}`}>Bio</Text>
          <TextInput
            editable={isEditing}
            multiline
            value={draft.bio}
            onChangeText={(bio) => setDraft((current) => ({ ...current, bio }))}
            placeholder="Add a short bio"
            placeholderTextColor="#71717A"
            className={`min-h-28 rounded-[22px] border p-4 text-base leading-6 ${
              isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
            }`}
            textAlignVertical="top"
          />
        </View>

        <View className={`mb-5 rounded-[30px] border p-5 ${softClass}`}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-orange-400">Theme</Text>
              <Text className={`text-xl font-black ${titleClass}`}>{colorMode === 'dark' ? 'Dark mode' : 'Light mode'}</Text>
            </View>
            <ThemeSlider colorMode={colorMode} onToggle={toggleColorMode} />
          </View>
        </View>

        <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className={`text-xl font-black ${titleClass}`}>Personal Details</Text>
            <Ionicons name="person-circle" size={24} color="#8B5CF6" />
          </View>
          <EditableField
            editable={isEditing}
            label="Phone"
            onChangeText={updatePhoneNumber}
            placeholder="Phone number"
            value={draft.phoneNumber}
          />
          <View className="mb-3">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className={`text-sm font-bold ${mutedClass}`}>Birth date</Text>
              {age ? <Text className="text-xs font-semibold text-zinc-500">{age} years old</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !isEditing }}
              disabled={!isEditing}
              onPress={() => {
                const parsedDate = parseProfileDate(draft.birthDate);

                if (parsedDate) {
                  setBirthVisibleMonth(startOfMonth(parsedDate));
                }

                setBirthCalendarOpen((current) => !current);
              }}
              className={`min-h-12 flex-row items-center justify-between rounded-2xl border px-3 ${
                isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'
              } ${isEditing ? '' : 'opacity-70'}`}>
              <Text className={`text-base font-semibold ${draft.birthDate ? titleClass : mutedClass}`}>
                {draft.birthDate || 'Choose birth date'}
              </Text>
              <Ionicons name={birthCalendarOpen ? 'chevron-up' : 'calendar'} size={18} color="#8B5CF6" />
            </Pressable>
            {birthCalendarOpen && isEditing ? (
              <CalendarDatePicker
                isDark={isDark}
                onChangeMonth={(offset) => setBirthVisibleMonth((current) => addMonths(current, offset))}
                onSelect={selectBirthDate}
                selectedDate={parseProfileDate(draft.birthDate)}
                visibleMonth={birthVisibleMonth}
              />
            ) : null}
          </View>
          <EditableField
            editable={isEditing}
            label="Education"
            onChangeText={(educationLevel) => setDraft((current) => ({ ...current, educationLevel }))}
            placeholder="Optional"
            value={draft.educationLevel}
          />
        </View>

        <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className={`text-xl font-black ${titleClass}`}>Categories</Text>
            <Ionicons name="pricetags" size={22} color="#8B5CF6" />
          </View>
          {isEditing ? (
            <CategorySelector
              selected={draft.interests}
              onChange={(interests) => setDraft((current) => ({ ...current, interests }))}
              minSelected={1}
            />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {draft.interests.map((interest) => (
                <View key={interest} className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-2">
                  <Text className="text-sm font-bold text-emerald-600">{interest}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="mb-5 flex-row gap-3">
          <PrimaryButton
            label={`Buy ${CURRENCY_NAME}`}
            icon="flame"
            tone="violet"
            onPress={() => setPurchaseOpen(true)}
            style={{ flex: 1 }}
          />
          <PrimaryButton label="Logout" icon="log-out" tone="danger" onPress={logout} style={{ flex: 1 }} />
        </View>
      </ScrollView>

      <BstPurchaseSheet visible={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
    </View>
  );
}

function EditableField({
  editable,
  helper,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  editable: boolean;
  helper?: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { isDark } = useGigStore();

  return (
    <View className="mb-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className={`text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
        {helper ? <Text className="text-xs font-semibold text-zinc-500">{helper}</Text> : null}
      </View>
      <TextInput
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#71717A"
        className={`min-h-12 rounded-2xl border px-3 text-base font-semibold ${
          isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
        }`}
      />
    </View>
  );
}

function ThemeSlider({ colorMode, onToggle }: { colorMode: 'light' | 'dark'; onToggle: () => void }) {
  const { isDark } = useGigStore();
  const darkActive = colorMode === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      className={`h-12 w-28 rounded-full border p-1 ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white'}`}>
      <View className={`absolute top-1 h-10 w-14 rounded-full bg-violet ${darkActive ? 'right-1' : 'left-1'}`} />
      <View className="h-full flex-row items-center">
        <View className="flex-1 items-center justify-center">
          <Ionicons name="sunny" size={20} color={!darkActive ? '#FFFFFF' : '#F59E0B'} />
        </View>
        <View className="flex-1 items-center justify-center">
          <Ionicons name="moon" size={20} color={darkActive ? '#FFFFFF' : '#8B5CF6'} />
        </View>
      </View>
    </Pressable>
  );
}

function CalendarDatePicker({
  isDark,
  onChangeMonth,
  onSelect,
  selectedDate,
  visibleMonth,
}: {
  isDark: boolean;
  onChangeMonth: (offset: number) => void;
  onSelect: (date: Date) => void;
  selectedDate: Date | null;
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

          const selected = sameDay(day, selectedDate);

          return (
            <View key={day.toISOString()} className="p-0.5" style={{ width: `${100 / 7}%`, aspectRatio: 1 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelect(day)}
                className={`h-full items-center justify-center rounded-2xl ${
                  selected ? 'bg-violet' : isDark ? 'bg-white/5' : 'bg-zinc-100'
                }`}>
                <Text className={`font-black ${selected ? 'text-white' : titleClass}`}>{day.getDate()}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TrustPanel({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { isDark } = useGigStore();

  return (
    <View className={`flex-1 rounded-[24px] p-3 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Ionicons name={icon} size={18} color={icon === 'briefcase' ? '#F97316' : '#10B981'} />
      <Text className={`mt-2 text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{value}</Text>
      <Text className={`text-xs font-semibold leading-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
    </View>
  );
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

function parseProfileDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatProfileDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
