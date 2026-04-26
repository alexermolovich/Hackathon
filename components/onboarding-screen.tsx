import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { createElement, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategorySelector } from '@/components/category-selector';
import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';
import type { Profile } from '@/lib/gig-types';
import {
  createPersistentProfileImageRef,
  createPersistentProfileImageRefFromUri,
  PROFILE_IMAGE_PICKER_OPTIONS,
} from '@/lib/profile-images';
import { resolveImageSource } from '@/lib/repo-images';
import { checkSelfieForSingleFace, type SelfieFaceCheckResult } from '@/lib/selfie-face-check';
import { APP_NAME, CURRENCY_NAME, EDUCATION_LEVELS, SIGNUP_BONUS_BSTS } from '@/lib/sidehustle-config';

type OnboardingStep = 'welcome' | 'phone' | 'identity' | 'about' | 'categories' | 'terms';

const accountSteps: OnboardingStep[] = ['identity', 'about', 'categories', 'terms'];
const homeLogoSource = require('../assets/images/favicon.png');
const sloganOrange = '#F97316';
const sloganViolet = '#8B5CF6';
const accountPhotoCameraOptions: ImagePicker.ImagePickerOptions = {
  ...PROFILE_IMAGE_PICKER_OPTIONS,
  cameraType: ImagePicker.CameraType.front,
};
const termsSections = [
  {
    heading: '1. The SideHustle Model (Platform Role)',
    body: [
      'SideHustle is a digital marketplace and lead-generation tool designed to connect individuals seeking to have tasks completed ("Gig Owners") with individuals willing to complete them ("Hustlers").',
      'We Are Not an Employer: SideHustle is not an employer, broker, agent, or joint venturer of any User. We do not provide the services requested in Gigs.',
      'We Are a Venue: We solely provide the software to facilitate introductions. The actual agreement for services is a direct contract between the Gig Owner and the Hustler.',
    ],
  },
  {
    heading: '2. Independent Contractor Acknowledgment',
    body: [
      'By using the Platform to provide services as a Hustler, you explicitly acknowledge and agree that you are operating as an independent business or independent contractor, not an employee of SideHustle.',
      'SideHustle does not dictate your working hours, your methods, or the specific tools you use.',
      'You are free to accept or reject any Gig by swiping left or right, with no penalty from SideHustle.',
      'You are solely responsible for negotiating the final scope, time, and payment of the Gig directly with the Gig Owner.',
    ],
  },
  {
    heading: '3. Blood & Sweat Tokens (BSTs) & In-App Economy',
    body: [
      'To unlock premium platform features, such as boosting a Gig, viewing additional Hustler bids, or unlocking a chat, users may utilize Blood & Sweat Tokens ("BSTs").',
      'Digital License Only: BSTs are a limited, non-exclusive, non-transferable digital license to access specific features within the Platform.',
      'No Cash Value: BSTs are not a fiat currency, do not accrue interest, and hold no real-world monetary value. They cannot be sold, transferred outside the app, or redeemed for USD or any other fiat currency from SideHustle.',
      'Purchases are Final: All fiat purchases of BSTs are final and non-refundable, subject to applicable App Store or Google Play Store policies.',
    ],
  },
  {
    heading: '4. Payments Between Users',
    body: [
      'SideHustle does not process, hold, or guarantee fiat payments for the completion of Gigs.',
      'Direct Settlement: Gig Owners and Hustlers must arrange payment for services rendered directly between themselves, such as via cash, Venmo, Zelle, or other peer-to-peer methods.',
      'Tax Liability: Users are entirely responsible for tracking and reporting their own income and paying all applicable local, state, and federal taxes. SideHustle does not withhold taxes or issue W-2s.',
    ],
  },
  {
    heading: '5. User Conduct and Safety (Compliance)',
    body: [
      'As a marketplace, we prioritize trust, but Users interact at their own risk.',
      'Work Authorization: It is the responsibility of the Gig Owner to verify that any Hustler they hire has the legal authorization to work in their respective jurisdiction. SideHustle does not conduct I-9 verification.',
      'Legality of Gigs: Users may not post or accept Gigs that involve illegal acts, highly regulated services requiring unverified licenses, or hazardous materials.',
    ],
  },
  {
    heading: '6. Limitation of Liability & "Negligent Referral" Shield',
    body: [
      'To the maximum extent permitted by law, SideHustle and its founders shall not be liable for any indirect, incidental, or consequential damages arising from the use of the Platform or the performance of any Gig.',
      'SideHustle does not guarantee the quality, safety, or legality of the Gigs posted, nor the qualifications or background of the Hustlers.',
      'Any dispute regarding property damage, personal injury, or incomplete work must be resolved directly between the Gig Owner and the Hustler. SideHustle is entirely indemnified from such claims.',
    ],
  },
  {
    heading: '7. Mandatory Arbitration',
    body: [
      'Any dispute, claim, or controversy arising out of or relating to these Terms or the breach thereof shall be settled by binding arbitration, rather than in court.',
      'You agree to waive any right to participate in a class-action lawsuit against SideHustle.',
    ],
  },
];
const webAvatarVideoStyle: CSSProperties = {
  backgroundColor: '#18181B',
  height: 260,
  objectFit: 'cover',
  transform: 'scaleX(-1)',
  width: '100%',
};
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

function onboardingFaceCheckMessage(result: SelfieFaceCheckResult) {
  if (result.status === 'NO_FACE') {
    return 'No face was detected. Keep your face centered and well lit.';
  }

  if (result.status === 'MULTIPLE_FACES') {
    return 'Only one face can be in the selfie.';
  }

  if (result.status === 'LOW_QUALITY') {
    return 'The selfie is too low quality. Move closer and use better lighting.';
  }

  if (result.status === 'UNSUPPORTED') {
    return 'Face detection could not load on this device.';
  }

  return 'Take a fresh, clear selfie and try again.';
}

function waitForOnboardingFaceCheck(promise: Promise<SelfieFaceCheckResult>) {
  return new Promise<SelfieFaceCheckResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('face-check-timeout')), 8_000);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  return {
    red: Number.parseInt(cleanHex.slice(0, 2), 16),
    green: Number.parseInt(cleanHex.slice(2, 4), 16),
    blue: Number.parseInt(cleanHex.slice(4, 6), 16),
  };
}

function mixHexColor(fromHex: string, toHex: string, amount: number) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const red = Math.round(from.red + (to.red - from.red) * amount);
  const green = Math.round(from.green + (to.green - from.green) * amount);
  const blue = Math.round(from.blue + (to.blue - from.blue) * amount);
  return `rgb(${red}, ${green}, ${blue})`;
}

function buildBrandGradient(length: number, middleColor: string) {
  if (length <= 1) {
    return [sloganOrange];
  }

  return Array.from({ length }, (_, index) => {
    const progress = index / (length - 1);

    return progress <= 0.5
      ? mixHexColor(sloganOrange, middleColor, progress * 2)
      : mixHexColor(middleColor, sloganViolet, (progress - 0.5) * 2);
  });
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
    authBypassProfiles,
    signInWithGoogle,
    signInWithAuthBypass,
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
  const [selfieVerified, setSelfieVerified] = useState(profile.is_verified);
  const [acceptedTerms, setAcceptedTerms] = useState(Boolean(profile.accepted_terms_at));
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsScrolledToEnd, setTermsScrolledToEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, setLogoTapCount] = useState(0);
  const [bypassPickerOpen, setBypassPickerOpen] = useState(false);
  const [bypassBusy, setBypassBusy] = useState(false);
  const [avatarCameraOpen, setAvatarCameraOpen] = useState(false);
  const [avatarCameraBusy, setAvatarCameraBusy] = useState(false);
  const [avatarCameraReady, setAvatarCameraReady] = useState(false);
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const avatarStreamRef = useRef<MediaStream | null>(null);

  const shellClass = isDark ? 'bg-black' : 'bg-zinc-100';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const welcomeSurfaceClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const brandGradientColors = useMemo(
    () => buildBrandGradient(APP_NAME.length, isDark ? '#FFFFFF' : '#18181B'),
    [isDark],
  );
  const inputClass = `rounded-[24px] border px-4 py-4 text-base ${
    isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-white text-zinc-950'
  }`;
  const canSendOtp = Boolean(phoneNumber.trim()) && !busy;
  const canVerifyOtp = /^\d{6}$/.test(otp.trim()) && !busy;
  const canLeaveIdentity = Boolean(username.trim());
  const canLeaveAbout = Boolean(isValidBirthDate(birthDate) && bio.trim() && educationLevel);
  const canFinish = Boolean(
    profile.google_authenticated &&
      profile.phone_verified &&
      canLeaveIdentity &&
      canLeaveAbout &&
      interests.length >= 5 &&
      acceptedTerms,
  );
  const avatarSource = resolveImageSource(avatarUrl);

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

  useEffect(() => {
    if (!avatarCameraOpen) {
      stopAvatarCamera();
      setAvatarCameraReady(false);
    }

    return stopAvatarCamera;
  }, [avatarCameraOpen]);

  useEffect(() => {
    if (step === 'terms' && !acceptedTerms) {
      setTermsScrolledToEnd(false);
      setTermsOpen(true);
    }
  }, [acceptedTerms, step]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !avatarCameraReady || !avatarVideoRef.current || !avatarStreamRef.current) {
      return;
    }

    avatarVideoRef.current.srcObject = avatarStreamRef.current;
    void avatarVideoRef.current.play().catch(() => {
      Alert.alert('Camera preview blocked', 'Press Capture Photo after the camera preview appears.');
    });
  }, [avatarCameraReady]);

  async function pickAvatar() {
    if (Platform.OS === 'web') {
      setAvatarCameraOpen(true);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Camera access needed', 'You can skip the selfie and create an unverified account, or allow camera access to verify now.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync(accountPhotoCameraOptions);

    if (!result.canceled && result.assets[0]?.uri) {
      setBusy(true);

      try {
        await verifyAndStoreOnboardingSelfie(result.assets[0].uri, result.assets[0]);
      } catch {
        Alert.alert('Selfie check failed', 'Take another clear selfie, or continue with an unverified account.');
      } finally {
        setBusy(false);
      }
    }
  }

  function stopAvatarCamera() {
    avatarStreamRef.current?.getTracks().forEach((track) => track.stop());
    avatarStreamRef.current = null;

    if (avatarVideoRef.current) {
      avatarVideoRef.current.srcObject = null;
    }
  }

  async function startAvatarCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      Alert.alert('Camera unavailable', 'This browser does not support direct camera capture.');
      return;
    }

    setAvatarCameraBusy(true);

    try {
      stopAvatarCamera();
      avatarStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          height: { ideal: 720 },
          width: { ideal: 720 },
        },
      });
      setAvatarCameraReady(true);
    } catch {
      Alert.alert('Camera access needed', 'Allow camera access to take a fresh profile photo.');
    } finally {
      setAvatarCameraBusy(false);
    }
  }

  async function captureAvatarPhoto() {
    const video = avatarVideoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      Alert.alert('Camera warming up', 'Give the camera a moment, then try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      Alert.alert('Photo failed', 'The browser could not capture this photo.');
      return;
    }

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setAvatarCameraBusy(true);

    try {
      await verifyAndStoreOnboardingSelfie(canvas.toDataURL('image/jpeg', 0.9));
      stopAvatarCamera();
      setAvatarCameraReady(false);
      setAvatarCameraOpen(false);
    } catch {
      Alert.alert('Selfie check failed', 'Take another clear selfie, or continue with an unverified account.');
    } finally {
      setAvatarCameraBusy(false);
    }
  }

  async function verifyAndStoreOnboardingSelfie(uri: string, asset?: ImagePicker.ImagePickerAsset) {
    const faceCheck = await waitForOnboardingFaceCheck(checkSelfieForSingleFace(uri));

    if (faceCheck.status !== 'READY') {
      Alert.alert('Selfie not verified', `${onboardingFaceCheckMessage(faceCheck)} You can still create an unverified account.`);
      return;
    }

    const nextAvatarUrl = asset
      ? await createPersistentProfileImageRef(asset)
      : await createPersistentProfileImageRefFromUri(uri);

    setAvatarUrl(nextAvatarUrl);
    setSelfieVerified(true);
  }

  async function continueWithGoogle() {
    setBusy(true);

    try {
      const result = await signInWithGoogle();

      if (!result.ok) {
        Alert.alert('Google connection failed', result.message ?? 'Check your Firebase Google provider settings.');
      }
    } finally {
      setBusy(false);
    }
  }

  function handleHomeLogoPress() {
    setLogoTapCount((current) => {
      const nextCount = current + 1;

      if (nextCount >= 5) {
        setBypassPickerOpen(true);
        return 0;
      }

      return nextCount;
    });
  }

  async function runAuthBypass(profileId: string) {
    setBypassBusy(true);

    try {
      const result = await signInWithAuthBypass(profileId);

      if (!result.ok) {
        Alert.alert('Demo login unavailable', result.message ?? 'Pick another account and try again.');
        return;
      }

      setBypassPickerOpen(false);
      router.replace('/');
    } finally {
      setBypassBusy(false);
    }
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

  function openTerms() {
    setTermsScrolledToEnd(false);
    setTermsOpen(true);
  }

  function handleTermsScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrolledToEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 28;

    if (scrolledToEnd) {
      setTermsScrolledToEnd(true);
    }
  }

  function acceptTerms() {
    setAcceptedTerms(true);
    setTermsOpen(false);
  }

  function declineTerms() {
    setAcceptedTerms(false);
    setTermsOpen(false);
    Alert.alert('Terms required', `You must accept the ${APP_NAME} Terms of Service before account creation can finish.`);
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
        selfieVerified,
      });
      router.replace('/');
    } catch (error) {
      Alert.alert('Account incomplete', error instanceof Error ? error.message : 'Finish every account step first.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className={`flex-1 ${shellClass}`}>
      <ScrollView className="flex-1" contentContainerClassName="grow px-5 pb-10 pt-3" showsVerticalScrollIndicator={false}>
        <View className={`${step === 'welcome' ? 'mb-3 justify-end' : 'mb-5 justify-between'} flex-row items-center`}>
          {step !== 'welcome' && (
            <View>
              <Text className="text-xs font-bold text-orange-400">{APP_NAME}</Text>
              <Text className={`text-2xl font-black ${titleClass}`}>Create Account</Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={toggleColorMode}
            className={`h-12 w-12 items-center justify-center rounded-full border ${softClass}`}>
            <Ionicons name={colorMode === 'dark' ? 'moon' : 'sunny'} size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
          </Pressable>
        </View>

        {step !== 'welcome' && step !== 'phone' && <ProgressDots currentStep={step} isDark={isDark} />}

        {authLoading ? (
          <View className="min-h-64 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : (
          <>
            {step === 'welcome' && (
              <View className="flex-1 pt-1">
                <View className={`relative flex-1 mb-5 min-h-[400px] overflow-hidden rounded-[38px] border ${welcomeSurfaceClass}`}>
                  <View className="absolute bg-violet" style={styles.welcomePurpleShape} />
                  <View className="absolute bg-orange-500" style={styles.welcomeOrangeShape} />
                  <View className="absolute bg-orange-400" style={styles.welcomeSlashOne} />
                  <View className="absolute bg-violet" style={styles.welcomeSlashTwo} />

                  <View className="relative z-10 flex-1">
                    <View style={styles.welcomeLogoAnchor}>
                      <Pressable
                        accessibilityLabel="SideHustle logo"
                        accessibilityRole="button"
                        hitSlop={12}
                        onPress={handleHomeLogoPress}
                        className="h-30 w-30 items-center justify-center overflow-hidden rounded-[20px] bg-transparent">
                        <Image source={homeLogoSource} style={{ height: 150, width: 150 }} contentFit="contain" />
                      </Pressable>
                    </View>

                    <View className="flex-row justify-center" style={styles.welcomeBrandCenter}>
                      {Array.from(APP_NAME).map((character, index) => (
                        <Text
                          key={`${character}-${index}`}
                          style={[styles.brandLetter, { color: brandGradientColors[index] }]}>
                          {character}
                        </Text>
                      ))}
                    </View>

                    <View className="items-end" style={styles.welcomeSloganRight}>
                      <Text className="text-right text-[42px] font-black leading-[46px] text-orange-500">Swipe.</Text>
                      <Text className={`text-right text-[42px] font-black leading-[46px] ${titleClass}`}>Earn.</Text>
                      <Text className="text-right text-[42px] font-black leading-[46px] text-violet">Repeat.</Text>
                    </View>
                  </View>
                </View>

                <View className="gap-3">
                  <PrimaryButton
                    label="Sign up with Google"
                    icon="logo-google"
                    tone="orange"
                    onPress={() => void continueWithGoogle()}
                    disabled={busy}
                  />
                  <PrimaryButton
                    label="Log in with Google"
                    icon="log-in"
                    tone="violet"
                    onPress={() => void continueWithGoogle()}
                    disabled={busy}
                  />
                </View>
              </View>
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
                      placeholder="------"
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
                  <View className="relative h-24 w-24">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void pickAvatar()}
                      className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-orange-400/30 bg-orange-500/15">
                      {avatarSource ? (
                        <Image source={avatarSource} style={{ height: 96, width: 96 }} contentFit="cover" />
                      ) : (
                        <Ionicons name="camera" size={30} color="#F97316" />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Edit profile image"
                      accessibilityRole="button"
                      onPress={() => void pickAvatar()}
                      className="absolute right-0 top-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-violet">
                      <Ionicons name="create" size={17} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <View className="flex-1">
                    <Text className={`text-lg font-black ${titleClass}`}>
                      Profile photo
                    </Text>
                    <Text className={`mt-1 text-sm leading-5 ${mutedClass}`}>
                      {selfieVerified ? 'Selfie captured. Your account will be verified.' : 'Optional selfie. Skip it to create an unverified account.'}
                    </Text>
                  </View>
                </View>
                <View className={`mb-5 rounded-[24px] border p-4 ${softClass}`}>
                  <View className="flex-row items-start gap-3">
                    <Ionicons name={selfieVerified ? 'shield-checkmark' : 'information-circle'} size={20} color={selfieVerified ? '#10B981' : '#F97316'} />
                    <Text className={`flex-1 text-sm font-semibold leading-5 ${mutedClass}`}>
                      {selfieVerified
                        ? 'Tip: your selfie will turn on the verified badge after account creation.'
                        : 'Tip: verification is not needed to create your account. Without a selfie, posting, chatting, and paid actions stay locked until you verify later.'}
                    </Text>
                  </View>
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
                  <View className="mb-4 flex-row items-start gap-3">
                    <View className={`mt-0.5 h-8 w-8 items-center justify-center rounded-full ${acceptedTerms ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                      <Ionicons name={acceptedTerms ? 'checkmark' : 'document-text'} size={17} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-base font-black ${titleClass}`}>SideHustle Terms of Service</Text>
                      <Text className={`mt-1 text-sm leading-5 ${mutedClass}`}>
                        {acceptedTerms
                          ? 'Accepted. You can finish account creation.'
                          : 'Review the Terms, scroll to the bottom, then accept before account creation can finish.'}
                      </Text>
                    </View>
                  </View>
                  <PrimaryButton
                    label={acceptedTerms ? 'Review Terms' : 'Open Terms'}
                    icon="document-text"
                    tone={acceptedTerms ? 'ghost' : 'orange'}
                    onPress={openTerms}
                  />
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
      <TermsOfServiceModal
        accepted={acceptedTerms}
        isDark={isDark}
        mutedClass={mutedClass}
        onAccept={acceptTerms}
        onDecline={declineTerms}
        onScroll={handleTermsScroll}
        onClose={() => setTermsOpen(false)}
        panelClass={panelClass}
        scrolledToEnd={termsScrolledToEnd}
        softClass={softClass}
        titleClass={titleClass}
        visible={termsOpen}
      />
      <AuthBypassAccountModal
        busy={bypassBusy}
        isDark={isDark}
        mutedClass={mutedClass}
        onClose={() => {
          if (!bypassBusy) {
            setBypassPickerOpen(false);
          }
        }}
        onSelect={(profileId) => void runAuthBypass(profileId)}
        panelClass={panelClass}
        profiles={authBypassProfiles}
        softClass={softClass}
        titleClass={titleClass}
        visible={bypassPickerOpen}
      />
      <Modal
        transparent
        animationType="fade"
        visible={avatarCameraOpen}
        onRequestClose={avatarCameraBusy ? undefined : () => setAvatarCameraOpen(false)}>
        <View className="flex-1 justify-end bg-black/75">
          <View className={`rounded-t-[34px] border p-5 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-orange-400">{APP_NAME}</Text>
                <Text className={`text-2xl font-black ${titleClass}`}>Selfie verification</Text>
              </View>
              <Pressable
                accessibilityLabel="Close profile photo camera"
                accessibilityRole="button"
                disabled={avatarCameraBusy}
                onPress={() => setAvatarCameraOpen(false)}
                className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
                <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
              </Pressable>
            </View>
            <Text className={`mb-4 text-sm leading-5 ${mutedClass}`}>
              Optional during signup. Capturing a fresh selfie here will mark this account verified.
            </Text>
            {avatarCameraReady ? (
              <View className={`mb-5 overflow-hidden rounded-[28px] border ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
                {createElement('video', {
                  autoPlay: true,
                  muted: true,
                  playsInline: true,
                  ref: avatarVideoRef,
                  style: webAvatarVideoStyle,
                })}
                {avatarCameraBusy ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <ActivityIndicator color="#FFFFFF" size="large" />
                  </View>
                ) : null}
              </View>
            ) : null}
            <PrimaryButton
              label={avatarCameraBusy ? 'Opening Camera' : avatarCameraReady ? 'Capture Photo' : 'Open Camera'}
              icon={avatarCameraBusy ? undefined : 'camera'}
              onPress={() => void (avatarCameraReady ? captureAvatarPhoto() : startAvatarCamera())}
              disabled={avatarCameraBusy}
            />
          </View>
        </View>
      </Modal>
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

function TermsOfServiceModal({
  accepted,
  isDark,
  mutedClass,
  onAccept,
  onClose,
  onDecline,
  onScroll,
  panelClass,
  scrolledToEnd,
  softClass,
  titleClass,
  visible,
}: {
  accepted: boolean;
  isDark: boolean;
  mutedClass: string;
  onAccept: () => void;
  onClose: () => void;
  onDecline: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  panelClass: string;
  scrolledToEnd: boolean;
  softClass: string;
  titleClass: string;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 px-4 py-5">
        <View className={`flex-1 overflow-hidden rounded-[32px] border ${panelClass}`}>
          <View className={`border-b px-5 pb-4 pt-5 ${isDark ? 'border-white/10' : 'border-zinc-200'}`}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold text-orange-400">{APP_NAME}</Text>
                <Text className={`text-2xl font-black ${titleClass}`}>Terms of Service</Text>
                <Text className={`mt-1 text-xs font-semibold ${mutedClass}`}>Last updated: April 26, 2026</Text>
              </View>
              <Pressable
                accessibilityLabel="Close terms of service"
                accessibilityRole="button"
                onPress={onClose}
                className={`h-11 w-11 items-center justify-center rounded-full ${softClass}`}>
                <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 py-5"
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator>
            <Text className={`mb-4 text-base leading-6 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {'Welcome to SideHustle. These Terms of Service ("Terms") govern your access to and use of the SideHustle mobile application and related services (the "Platform"). By creating an account or using the Platform, you agree to these Terms.'}
            </Text>
            {termsSections.map((section) => (
              <View key={section.heading} className="mb-5">
                <Text className={`mb-2 text-lg font-black ${titleClass}`}>{section.heading}</Text>
                {section.body.map((paragraph) => (
                  <Text key={paragraph} className={`mb-3 text-sm leading-6 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>

          <View className={`border-t px-5 py-4 ${isDark ? 'border-white/10' : 'border-zinc-200'}`}>
            {!accepted && (
              <Text className={`mb-3 text-center text-xs font-bold ${scrolledToEnd ? 'text-emerald-500' : mutedClass}`}>
                {scrolledToEnd ? 'Ready to accept.' : 'Scroll to the bottom to enable Accept.'}
              </Text>
            )}
            {accepted ? (
              <PrimaryButton label="Done" icon="checkmark" tone="emerald" onPress={onClose} />
            ) : (
              <View className="flex-row gap-3">
                <PrimaryButton label="Decline" icon="close" tone="ghost" onPress={onDecline} style={{ flex: 1 }} />
                <PrimaryButton
                  label="Accept"
                  icon="checkmark"
                  tone="emerald"
                  onPress={onAccept}
                  disabled={!scrolledToEnd}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AuthBypassAccountModal({
  busy,
  isDark,
  mutedClass,
  onClose,
  onSelect,
  panelClass,
  profiles,
  softClass,
  titleClass,
  visible,
}: {
  busy: boolean;
  isDark: boolean;
  mutedClass: string;
  onClose: () => void;
  onSelect: (profileId: string) => void;
  panelClass: string;
  profiles: Profile[];
  softClass: string;
  titleClass: string;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/80">
        <View className={`max-h-[82%] rounded-t-[34px] border p-5 ${panelClass}`}>
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs font-bold text-orange-400">Phone testing</Text>
              <Text className={`text-2xl font-black ${titleClass}`}>Choose account</Text>
            </View>
            <Pressable
              accessibilityLabel="Close demo account chooser"
              accessibilityRole="button"
              disabled={busy}
              onPress={onClose}
              className={`h-11 w-11 items-center justify-center rounded-full ${softClass}`}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {profiles.length > 0 ? (
              <View className="gap-3 pb-2">
                {profiles.map((item) => {
                  const avatarSource = resolveImageSource(item.avatar_url);
                  const details = [item.interests.slice(0, 3).join(', '), `${item.credits} ${CURRENCY_NAME}`]
                    .filter(Boolean)
                    .join(' | ');

                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => onSelect(item.id)}
                      className={`flex-row items-center gap-3 rounded-[24px] border p-3 ${softClass} ${busy ? 'opacity-60' : ''}`}>
                      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-orange-500/15">
                        {avatarSource ? (
                          <Image source={avatarSource} style={{ height: 64, width: 64 }} contentFit="cover" />
                        ) : (
                          <Ionicons name="person" size={24} color="#F97316" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className={`text-base font-black ${titleClass}`} numberOfLines={1}>
                          {item.username}
                        </Text>
                        <Text className={`mt-1 text-xs font-semibold ${mutedClass}`} numberOfLines={2}>
                          {details || item.bio}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator color="#F97316" />
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View className={`rounded-[24px] border p-4 ${softClass}`}>
                <Text className={`text-center text-sm font-semibold ${mutedClass}`}>
                  No bypass accounts are available yet.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
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

const styles = StyleSheet.create({
  brandLetter: {
    fontSize: 60,
    fontWeight: '900',
    lineHeight: 52,
  },
  welcomeBrandCenter: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -26 }], // Perfectly offsets half the height of the 52px text
  },
  welcomeLogoAnchor: {
    left: 20, // Matched padding
    position: 'absolute',
    top: 20,  // Matched padding
  },
  welcomeOrangeShape: {
    borderRadius: 250,
    bottom: -220,
    height: 380,
    left: -220,
    opacity: 0.88,
    width: 480,
  },
  welcomePurpleShape: {
    borderRadius: 250,
    height: 380,
    opacity: 0.86,
    position: 'absolute',
    right: -220,
    top: -220,
    width: 480,
  },
  welcomeSlashOne: {
    borderRadius: 999,
    bottom: 60,
    height: 24,
    left: -10,
    opacity: 0.75,
    position: 'absolute',
    transform: [{ rotate: '-24deg' }],
    width: 180,
  },
  welcomeSlashTwo: {
    borderRadius: 999,
    height: 24,
    opacity: 0.72,
    position: 'absolute',
    right: -10,
    top: 60,
    transform: [{ rotate: '-24deg' }],
    width: 180,
  },
  welcomeSloganRight: {
    position: 'absolute',
    right: 20,  // Matched padding
    bottom: 20, // Matched padding
  },
});
