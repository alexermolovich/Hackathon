import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategorySelector } from '@/components/category-selector';
import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';
import { APP_NAME, CURRENCY_NAME, EDUCATION_LEVELS, SIGNUP_BONUS_BSTS } from '@/lib/sidehustle-config';

type OnboardingStep = 'welcome' | 'phone' | 'identity' | 'about' | 'categories' | 'terms';

const accountSteps: OnboardingStep[] = ['identity', 'about', 'categories', 'terms'];
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

function isValidBirthDate(value: string) {
  const date = parseDate(value);
  return Boolean(date && date <= new Date());
}

function getInitialStep(googleAuthenticated: boolean, phoneVerified: boolean): OnboardingStep {
  if (!googleAuthenticated) {
    return 'welcome';
  }

  if (!phoneVerified) {
    return 'phone';
  }

  return 'identity';
}

export function OnboardingScreen() {
  const {
    profile,
    authLoading,
    authUserEmail,
    authUserName,
    startPhoneOnlyAuth,
    signInWithGoogle,
    requestPhoneVerification,
    confirmPhoneVerification,
    completeOnboarding,
    isDark,
    colorMode,
    toggleColorMode,
  } = useGigStore();
  const [step, setStep] = useState<OnboardingStep>(() =>
    getInitialStep(profile.google_authenticated, profile.phone_verified),
  );
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [birthDate, setBirthDate] = useState(profile.birth_date);
  const [bio, setBio] = useState(profile.bio);
  const [educationLevel, setEducationLevel] = useState(profile.education_level ?? '');
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [acceptedTerms, setAcceptedTerms] = useState(Boolean(profile.accepted_terms_at));
  const [busy, setBusy] = useState(false);

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const inputClass = `rounded-[24px] border px-4 py-4 text-base ${
    isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-white text-zinc-950'
  }`;
  const canSendOtp = Boolean(phoneNumber.trim()) && !busy;
  const canVerifyOtp = /^\d{6}$/.test(otp.trim()) && !busy;
  const canLeaveIdentity = Boolean(username.trim() && avatarUrl);
  const canLeaveAbout = Boolean(isValidBirthDate(birthDate) && bio.trim() && educationLevel);
  const canFinish = Boolean(
    profile.google_authenticated &&
      profile.phone_verified &&
      canLeaveIdentity &&
      canLeaveAbout &&
      interests.length >= 5 &&
      acceptedTerms,
  );

  useEffect(() => {
    if (!profile.google_authenticated) {
      setStep('welcome');
      return;
    }

    if (!profile.phone_verified) {
      setStep('phone');
      return;
    }

    setPhoneNumber(profile.phone_number);

    if (step === 'welcome' || step === 'phone') {
      setStep('identity');
    }
  }, [profile.google_authenticated, profile.phone_number, profile.phone_verified, step]);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Add a profile photo to finish account creation.');
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

  async function handleGoogle() {
    setBusy(true);

    try {
      const result = await signInWithGoogle();

      if (!result.ok) {
        Alert.alert('Google sign-in failed', result.message ?? 'Check your Firebase Google provider settings.');
      }
    } finally {
      setBusy(false);
    }
  }

  function handlePhoneOnly() {
    const result = startPhoneOnlyAuth();

    if (!result.ok) {
      Alert.alert('Phone verification unavailable', result.message ?? 'Check your Firebase setup.');
      return;
    }

    setStep('phone');
  }

  async function sendOtp() {
    setBusy(true);

    try {
      const result = await requestPhoneVerification(phoneNumber);

      if (!result.ok) {
        Alert.alert('Phone verification failed', result.message ?? 'Check your phone number and SMS provider.');
        return;
      }

      if (result.phone) {
        setPhoneNumber(result.phone);
      }

      setOtp('');
      setOtpSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);

    try {
      const result = await confirmPhoneVerification(phoneNumber, otp);

      if (!result.ok) {
        Alert.alert('Code not verified', result.message ?? 'Check the code and try again.');
        return;
      }

      if (result.phone) {
        setPhoneNumber(result.phone);
      }

      setOtp('');
      setStep('identity');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!canFinish) {
      return;
    }

    setBusy(true);

    try {
      await completeOnboarding({
        username,
        phoneNumber,
        birthDate,
        bio,
        educationLevel,
        interests,
        avatarUrl,
      });
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-3" showsVerticalScrollIndicator={false}>
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-orange-400">{APP_NAME}</Text>
            <Text className={`text-4xl font-black ${titleClass}`}>
              {step === 'welcome' ? APP_NAME : 'Create account'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={toggleColorMode}
            className={`h-12 w-12 items-center justify-center rounded-full border ${softClass}`}>
            <Ionicons name={colorMode === 'dark' ? 'moon' : 'sunny'} size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
          </Pressable>
        </View>

        {step !== 'welcome' && step !== 'phone' && <ProgressDots currentStep={step} isDark={isDark} />}

        {authLoading ? (
          <View className={`rounded-[32px] border p-6 ${panelClass}`}>
            <Text className={`text-2xl font-black ${titleClass}`}>Loading</Text>
          </View>
        ) : (
          <>
            {step === 'welcome' && (
              <StepPanel panelClass={panelClass}>
                <View className="mb-7">
                  <Text className={`text-5xl font-black ${titleClass}`}>{APP_NAME}</Text>
                  <Text className={`mt-2 text-base font-semibold ${mutedClass}`}>Local work, verified people.</Text>
                </View>
                <View className="gap-3">
                  <PrimaryButton
                    label="Sign up with Google"
                    icon="logo-google"
                    onPress={() => void handleGoogle()}
                    disabled={busy}
                  />
                  <PrimaryButton
                    label="Log in with Google"
                    icon="log-in"
                    tone="ghost"
                    onPress={() => void handleGoogle()}
                    disabled={busy}
                  />
                </View>
              </StepPanel>
            )}

            {step === 'phone' && (
              <StepPanel panelClass={panelClass}>
                <View className="mb-5">
                  <StatusPill icon="checkmark-circle" label={authUserName ?? authUserEmail ?? 'Phone-first signup'} />
                  <Text className={`mt-4 text-3xl font-black ${titleClass}`}>Verify phone</Text>
                </View>
                <Field label="Phone number" labelClass={mutedClass}>
                  <TextInput
                    value={phoneNumber}
                    onChangeText={(value) => {
                      setPhoneNumber(value);
                      setOtpSent(false);
                    }}
                    keyboardType="phone-pad"
                    placeholder="+1 605 555 0100"
                    placeholderTextColor="#71717A"
                    className={`${inputClass} font-semibold`}
                  />
                </Field>
                {otpSent && (
                  <Field label="Verification code" labelClass={mutedClass}>
                    <TextInput
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="······"
                      placeholderTextColor="#71717A"
                      className={`${inputClass} text-center text-2xl font-black tracking-widest`}
                    />
                  </Field>
                )}
                <View className="gap-3">
                  <PrimaryButton
                    label={otpSent ? 'Send New Code' : 'Send Code'}
                    icon="chatbubble-ellipses"
                    tone={otpSent ? 'ghost' : 'violet'}
                    onPress={() => void sendOtp()}
                    disabled={!canSendOtp}
                  />
                  {otpSent && (
                    <PrimaryButton
                      label="Verify Phone"
                      icon="shield-checkmark"
                      onPress={() => void verifyOtp()}
                      disabled={!canVerifyOtp}
                    />
                  )}
                </View>
              </StepPanel>
            )}

            {step === 'identity' && (
              <StepPanel panelClass={panelClass}>
                <Text className={`mb-5 text-3xl font-black ${titleClass}`}>Name and photo</Text>
                <View className="mb-5 flex-row items-center gap-4">
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
                  <PrimaryButton
                    label={avatarUrl ? 'Change Photo' : 'Add Photo'}
                    icon="camera"
                    tone="ghost"
                    onPress={() => void pickAvatar()}
                    style={{ flex: 1 }}
                  />
                </View>
                <Field label="Name" labelClass={mutedClass}>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Your full name"
                    placeholderTextColor="#71717A"
                    className={`${inputClass} font-semibold`}
                  />
                </Field>
                <PrimaryButton
                  label="Continue"
                  icon="arrow-forward"
                  onPress={() => setStep('about')}
                  disabled={!canLeaveIdentity}
                />
              </StepPanel>
            )}

            {step === 'about' && (
              <StepPanel panelClass={panelClass}>
                <Text className={`mb-5 text-3xl font-black ${titleClass}`}>About you</Text>
                <Field label="Birthdate" labelClass={mutedClass}>
                  <BirthDatePicker
                    value={birthDate}
                    onChange={setBirthDate}
                    isDark={isDark}
                    titleClass={titleClass}
                    mutedClass={mutedClass}
                    softClass={softClass}
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
                          onPress={() => setEducationLevel(level)}
                          className={`min-h-10 rounded-full border px-3 ${
                            active ? 'border-violet bg-violet' : softClass
                          }`}>
                          <Text className={`py-2 text-sm font-bold ${active || isDark ? 'text-white' : 'text-zinc-950'}`}>
                            {level}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>
                <StepActions
                  back={() => setStep('identity')}
                  next={() => setStep('categories')}
                  nextDisabled={!canLeaveAbout}
                />
              </StepPanel>
            )}

            {step === 'categories' && (
              <StepPanel panelClass={panelClass}>
                <Text className={`mb-2 text-3xl font-black ${titleClass}`}>Categories</Text>
                <CategorySelector selected={interests} onChange={setInterests} minSelected={5} />
                <StepActions
                  back={() => setStep('about')}
                  next={() => setStep('terms')}
                  nextDisabled={interests.length < 5}
                />
              </StepPanel>
            )}

            {step === 'terms' && (
              <StepPanel panelClass={panelClass}>
                <Text className={`mb-5 text-3xl font-black ${titleClass}`}>Finish</Text>
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
                      I accept the terms and conditions for {APP_NAME}.
                    </Text>
                  </Pressable>
                </View>
                <View className="mb-4 flex-row items-center justify-center gap-2">
                  <Ionicons name="flame" size={18} color="#F97316" />
                  <Text className={`text-sm font-bold ${titleClass}`}>
                    Signup bonus: +{SIGNUP_BONUS_BSTS} {CURRENCY_NAME}
                  </Text>
                </View>
                <View className="gap-3">
                  <PrimaryButton
                    label={`Enter ${APP_NAME}`}
                    icon="flame"
                    onPress={() => void submit()}
                    disabled={!canFinish || busy}
                  />
                  <PrimaryButton label="Back" icon="arrow-back" tone="ghost" onPress={() => setStep('categories')} />
                </View>
              </StepPanel>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StepPanel({ panelClass, children }: { panelClass: string; children: ReactNode }) {
  return <View className={`rounded-[32px] border p-5 ${panelClass}`}>{children}</View>;
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

function ProgressDots({ currentStep, isDark }: { currentStep: OnboardingStep; isDark: boolean }) {
  const activeIndex = accountSteps.indexOf(currentStep);

  return (
    <View className="mb-5 flex-row gap-2">
      {accountSteps.map((item, index) => (
        <View
          key={item}
          className={`h-2 flex-1 rounded-full ${
            index <= activeIndex ? 'bg-violet' : isDark ? 'bg-white/10' : 'bg-zinc-200'
          }`}
        />
      ))}
    </View>
  );
}

function StatusPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="self-start flex-row items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-2">
      <Ionicons name={icon} size={16} color="#10B981" />
      <Text className="text-sm font-black text-emerald-500">{label}</Text>
    </View>
  );
}

function StepActions({
  back,
  next,
  nextDisabled,
}: {
  back: () => void;
  next: () => void;
  nextDisabled: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <PrimaryButton label="Back" icon="arrow-back" tone="ghost" onPress={back} style={{ flex: 1 }} />
      <PrimaryButton label="Continue" icon="arrow-forward" onPress={next} disabled={nextDisabled} style={{ flex: 1 }} />
    </View>
  );
}

function BirthDatePicker({
  value,
  onChange,
  isDark,
  titleClass,
  mutedClass,
  softClass,
}: {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  titleClass: string;
  mutedClass: string;
  softClass: string;
}) {
  const selectedDate = parseDate(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date(2000, 0, 1));
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [viewDate]);

  function moveMonth(direction: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function chooseDay(day: number) {
    const nextDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

    if (nextDate > today) {
      return;
    }

    onChange(formatDate(nextDate));
    setOpen(false);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
        className={`min-h-14 flex-row items-center justify-between rounded-[24px] border px-4 ${softClass}`}>
        <Text className={`text-base font-semibold ${value ? titleClass : mutedClass}`}>
          {value || 'Choose birthdate'}
        </Text>
        <Ionicons name="calendar" size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
      </Pressable>

      {open && (
        <View className={`mt-3 rounded-[24px] border p-3 ${softClass}`}>
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable accessibilityRole="button" onPress={() => moveMonth(-1)} className="h-10 w-10 items-center justify-center rounded-full">
              <Ionicons name="chevron-back" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
            <Text className={`text-base font-black ${titleClass}`}>
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => moveMonth(1)} className="h-10 w-10 items-center justify-center rounded-full">
              <Ionicons name="chevron-forward" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          </View>
          <View className="mb-2 flex-row">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} className={`flex-1 text-center text-xs font-black ${mutedClass}`}>
                {day}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {days.map((day, index) => {
              const dateForCell = day ? new Date(viewDate.getFullYear(), viewDate.getMonth(), day) : null;
              const disabled = !day || Boolean(dateForCell && dateForCell > today);
              const selected = Boolean(selectedDate && dateForCell && formatDate(selectedDate) === formatDate(dateForCell));

              return (
                <Pressable
                  key={`${viewDate.toISOString()}-${index}`}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => day && chooseDay(day)}
                  style={{ width: `${100 / 7}%` }}
                  className="h-10 items-center justify-center">
                  {day && (
                    <View className={`h-9 w-9 items-center justify-center rounded-full ${selected ? 'bg-violet' : ''}`}>
                      <Text
                        className={`text-sm font-bold ${
                          selected ? 'text-white' : disabled ? mutedClass : titleClass
                        }`}>
                        {day}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
