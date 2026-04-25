import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategorySelector } from '@/components/category-selector';
import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';
import { EDUCATION_LEVELS, SIGNUP_BONUS_BSTS, CURRENCY_NAME } from '@/lib/sidehustle-config';

export function OnboardingScreen() {
  const { profile, completeOnboarding, isDark, colorMode, toggleColorMode } = useGigStore();
  const [googleReady, setGoogleReady] = useState(profile.google_authenticated);
  const [username, setUsername] = useState(profile.username);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number);
  const [birthDate, setBirthDate] = useState(profile.birth_date);
  const [bio, setBio] = useState(profile.bio);
  const [educationLevel, setEducationLevel] = useState<string | null>(profile.education_level);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [acceptedTerms, setAcceptedTerms] = useState(Boolean(profile.accepted_terms_at));

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const inputClass = `rounded-[24px] border px-4 py-4 text-base ${
    isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-white text-zinc-950'
  }`;

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Add a profile picture to finish account creation.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUrl(result.assets[0].uri);
    }
  }

  async function submit() {
    if (!googleReady) {
      Alert.alert('Google required', 'Continue with Google before creating your account.');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Phone required', 'Add a phone number to keep duplicate accounts out.');
      return;
    }

    if (!username.trim() || !birthDate.trim() || !bio.trim()) {
      Alert.alert('Missing info', 'Add your name, birth date, and bio.');
      return;
    }

    if (!avatarUrl) {
      Alert.alert('Profile picture required', 'Add a profile picture before continuing.');
      return;
    }

    if (interests.length < 5) {
      Alert.alert('Pick categories', 'Choose at least five categories you are interested in.');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Terms required', 'Accept the terms and conditions to continue.');
      return;
    }

    await completeOnboarding({
      username,
      phoneNumber,
      birthDate,
      bio,
      educationLevel,
      interests,
      avatarUrl,
    });
  }

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-3" showsVerticalScrollIndicator={false}>
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-orange-400">SideHustle</Text>
            <Text className={`text-4xl font-black ${titleClass}`}>Create account</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={toggleColorMode}
            className={`h-12 w-12 items-center justify-center rounded-full border ${softClass}`}>
            <Ionicons name={colorMode === 'dark' ? 'moon' : 'sunny'} size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
          </Pressable>
        </View>

        <View className={`mb-5 rounded-[32px] border p-5 ${panelClass}`}>
          <View className="mb-4 flex-row items-center gap-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => void pickAvatar()}
              className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-orange-400/30 bg-orange-500/15">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ height: 96, width: 96 }} contentFit="cover" />
              ) : (
                <Ionicons name="camera" size={30} color="#F97316" />
              )}
            </Pressable>
            <View className="flex-1">
              <Text className={`mb-1 text-xl font-black ${titleClass}`}>Profile picture</Text>
              <Text className={`text-sm leading-5 ${mutedClass}`}>
                Your picture is required before you can swipe, post, or unlock chats.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setGoogleReady(true)}
            className={`min-h-14 flex-row items-center justify-center gap-2 rounded-[24px] border ${
              googleReady ? 'border-emerald-400/30 bg-emerald-500/15' : softClass
            }`}>
            <Ionicons name={googleReady ? 'checkmark-circle' : 'logo-google'} size={20} color={googleReady ? '#10B981' : '#8B5CF6'} />
            <Text className={`font-black ${titleClass}`}>{googleReady ? 'Google connected' : 'Continue with Google'}</Text>
          </Pressable>
        </View>

        <View className={`mb-5 rounded-[32px] border p-5 ${panelClass}`}>
          <Field label="Name" labelClass={mutedClass}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Your full name"
              placeholderTextColor="#71717A"
              className={`${inputClass} font-semibold`}
            />
          </Field>
          <Field label="Phone number" labelClass={mutedClass}>
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="+1 605 555 0100"
              placeholderTextColor="#71717A"
              className={`${inputClass} font-semibold`}
            />
          </Field>
          <Field label="Birth date" labelClass={mutedClass}>
            <TextInput
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#71717A"
              className={`${inputClass} font-semibold`}
            />
          </Field>
          <Field label="Bio" labelClass={mutedClass}>
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="What are you great at?"
              placeholderTextColor="#71717A"
              className={`${inputClass} min-h-28 leading-6`}
              textAlignVertical="top"
            />
          </Field>
          <Field label="Highest education level" labelClass={mutedClass}>
            <View className="flex-row flex-wrap gap-2">
              {EDUCATION_LEVELS.map((level) => {
                const active = educationLevel === level;

                return (
                  <Pressable
                    key={level}
                    accessibilityRole="button"
                    onPress={() => setEducationLevel(level === 'Prefer not to say' ? null : level)}
                    className={`min-h-10 rounded-full border px-3 ${
                      active || (!educationLevel && level === 'Prefer not to say')
                        ? 'border-violet bg-violet'
                        : softClass
                    }`}>
                    <Text className={`py-2 text-sm font-bold ${active || (!educationLevel && level === 'Prefer not to say') || isDark ? 'text-white' : 'text-zinc-950'}`}>
                      {level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        </View>

        <View className={`mb-5 rounded-[32px] border p-5 ${panelClass}`}>
          <Text className={`mb-2 text-xl font-black ${titleClass}`}>Categories</Text>
          <CategorySelector selected={interests} onChange={setInterests} minSelected={5} />
        </View>

        <View className={`mb-5 rounded-[28px] border p-4 ${softClass}`}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            onPress={() => setAcceptedTerms((current) => !current)}
            className="flex-row items-start gap-3">
            <View className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${acceptedTerms ? 'border-violet bg-violet' : 'border-zinc-400'}`}>
              {acceptedTerms && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
            <Text className={`flex-1 text-sm leading-5 ${mutedClass}`}>
              I accept the terms and conditions for SideHustle.
            </Text>
          </Pressable>
        </View>

        <View className="mb-4 flex-row items-center justify-center gap-2">
          <Ionicons name="flame" size={18} color="#F97316" />
          <Text className={`text-sm font-bold ${titleClass}`}>Signup bonus: +{SIGNUP_BONUS_BSTS} {CURRENCY_NAME}</Text>
        </View>

        <PrimaryButton label="Enter SideHustle" icon="flame" onPress={() => void submit()} />
      </ScrollView>
    </SafeAreaView>
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
