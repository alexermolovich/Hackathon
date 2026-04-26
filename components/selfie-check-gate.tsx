import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { createElement, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';
import {
  createPersistentProfileImageRef,
  createPersistentProfileImageRefFromUri,
  PROFILE_IMAGE_PICKER_OPTIONS,
} from '@/lib/profile-images';
import { checkSelfieForSingleFace, type SelfieFaceCheckResult } from '@/lib/selfie-face-check';

type SelfieCheckGateProps = {
  allowVerified?: boolean;
  onVerified?: (avatarUri: string) => void;
  onClose: () => void;
  suppressSuccessNotice?: boolean;
  successMessage?: string;
  title?: string;
  visible: boolean;
};

type SelfieNotice = {
  message?: string;
  onDismiss?: () => void;
  title: string;
  tone: 'error' | 'success';
};

const cameraSelfieOptions: ImagePicker.ImagePickerOptions = {
  ...PROFILE_IMAGE_PICKER_OPTIONS,
  cameraType: ImagePicker.CameraType.front,
};

const webVideoStyle: CSSProperties = {
  backgroundColor: '#18181B',
  height: 220,
  objectFit: 'cover',
  transform: 'scaleX(-1)',
  width: '100%',
};

export function SelfieCheckGate({
  allowVerified = false,
  onClose,
  onVerified,
  suppressSuccessNotice = false,
  successMessage = 'Your verified badge is active.',
  title = 'Verify selfie',
  visible,
}: SelfieCheckGateProps) {
  const { profile, verifySelfie, isDark } = useGigStore();
  const [busy, setBusy] = useState(false);
  const [webCameraOpening, setWebCameraOpening] = useState(false);
  const [notice, setNotice] = useState<SelfieNotice | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [webCameraReady, setWebCameraReady] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!visible) {
      stopWebCamera();
      setWebCameraReady(false);
      setPreviewUri(null);
    }

    return stopWebCamera;
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !webCameraReady || !webVideoRef.current || !webStreamRef.current) {
      return;
    }

    webVideoRef.current.srcObject = webStreamRef.current;
    void webVideoRef.current.play().catch(() => {
      showNotice('Camera preview blocked', 'Press Capture Selfie after the camera preview appears.');
    });
  }, [webCameraReady]);

  const showGateModal = visible && (!profile.is_verified || allowVerified);

  if (!visible && !notice) {
    return null;
  }

  if (!showGateModal && !notice) {
    return null;
  }

  function stopWebCamera() {
    webStreamRef.current?.getTracks().forEach((track) => track.stop());
    webStreamRef.current = null;

    if (webVideoRef.current) {
      webVideoRef.current.srcObject = null;
    }
  }

  async function startWebCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showNotice('Camera unavailable', 'This browser does not support direct camera capture.');
      return;
    }

    setWebCameraOpening(true);

    try {
      stopWebCamera();
      const stream = await waitForWebCamera(
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            height: { ideal: 720 },
            width: { ideal: 720 },
          },
        }),
      );

      webStreamRef.current = stream;

      setPreviewUri(null);
      setWebCameraReady(true);
    } catch (error) {
      showNotice(
        'Camera access needed',
        error instanceof Error && error.message === 'camera-timeout'
          ? 'The camera request timed out. Check that another app is not using your camera, then try again.'
          : 'Allow camera access to take a fresh selfie.',
      );
    } finally {
      setWebCameraOpening(false);
    }
  }

  async function captureWebSelfie() {
    const video = webVideoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      showNotice('Camera warming up', 'Give the camera a moment, then try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      showNotice('Selfie failed', 'The browser could not capture this selfie.');
      return;
    }

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopWebCamera();
    setWebCameraReady(false);
    await verifyCapturedSelfie(canvas.toDataURL('image/jpeg', 0.9));
  }

  async function verifyCapturedSelfie(uri: string, asset?: ImagePicker.ImagePickerAsset) {
    setPreviewUri(uri);
    setBusy(true);

    try {
      const faceCheck = await waitForSelfieCheck(checkSelfieForSingleFace(uri));

      if (faceCheck.status !== 'READY') {
        showNotice('Selfie not verified', faceCheckMessage(faceCheck));
        return;
      }

      const avatarUri = asset
        ? await createPersistentProfileImageRef(asset)
        : await createPersistentProfileImageRefFromUri(uri);

      await verifySelfie(avatarUri);
      onVerified?.(avatarUri);

      if (suppressSuccessNotice) {
        onClose();
      } else {
        showNotice('Selfie verified', successMessage, 'success', onClose);
      }
    } catch (error) {
      showNotice(
        'Selfie check failed',
        error instanceof Error && error.message === 'face-check-timeout'
          ? 'Face detection took too long. Retake the selfie with better lighting and try again.'
          : 'Take a fresh, well-lit selfie and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function runSelfieCheck() {
    if (Platform.OS === 'web') {
      if (webCameraReady) {
        await captureWebSelfie();
        return;
      }

      await startWebCamera();
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      showNotice('Camera access needed', 'Take a fresh selfie to unlock posting, chatting, and paid actions.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync(cameraSelfieOptions);

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const asset = result.assets[0];
    await verifyCapturedSelfie(asset.uri, asset);
  }

  function showNotice(title: string, message?: string, tone: SelfieNotice['tone'] = 'error', onDismiss?: () => void) {
    setNotice({ message, onDismiss, title, tone });
  }

  function dismissNotice() {
    const onDismiss = notice?.onDismiss;

    setNotice(null);
    onDismiss?.();
  }

  function closeGate() {
    stopWebCamera();
    setWebCameraReady(false);
    setPreviewUri(null);
    onClose();
  }

  return (
    <>
      <Modal transparent animationType="fade" visible={showGateModal} onRequestClose={closeGate}>
        <View className="flex-1 justify-end bg-black/75">
          <View className={`rounded-t-[36px] border p-6 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
            <View className="mb-5 flex-row items-center justify-between">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-violet">
                <Ionicons name="shield-checkmark" size={30} color="#FFFFFF" />
              </View>
              <Pressable
                accessibilityLabel="Close selfie verification"
                accessibilityRole="button"
                onPress={closeGate}
                className={`h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
                <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#18181B'} />
              </Pressable>
            </View>

            <Text className={`mb-2 text-4xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>
              {title}
            </Text>
            <Text className={`mb-5 text-base leading-6 ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
              Tip: verification is not needed to create your account. It unlocks posting, chatting, and paid actions.
            </Text>
            <Text className={`mb-5 text-sm leading-5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Face verification allows to protect our platform from bots and ensures a safer community.
            </Text>

            {Platform.OS === 'web' && webCameraReady ? (
              <View className={`mb-5 overflow-hidden rounded-[28px] border ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
                {createElement('video', {
                  autoPlay: true,
                  muted: true,
                  playsInline: true,
                  ref: webVideoRef,
                  style: webVideoStyle,
                })}
                {busy ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <ActivityIndicator color="#FFFFFF" size="large" />
                  </View>
                ) : null}
              </View>
            ) : previewUri ? (
              <View className={`mb-5 overflow-hidden rounded-[28px] border ${isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'}`}>
                <Image source={{ uri: previewUri }} style={{ height: 220, width: '100%' }} contentFit="cover" />
                {busy ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <ActivityIndicator color="#FFFFFF" size="large" />
                  </View>
                ) : null}
              </View>
            ) : null}

            <PrimaryButton
              label={
                webCameraOpening
                  ? 'Opening Camera'
                  : busy
                  ? webCameraReady
                    ? 'Capturing Selfie'
                    : previewUri
                      ? 'Checking Selfie'
                      : 'Checking Selfie'
                  : webCameraReady
                    ? 'Capture Selfie'
                    : profile.is_verified
                      ? 'Retake Selfie'
                      : 'Take Selfie'
              }
              icon={busy || webCameraOpening ? undefined : 'camera'}
              onPress={() => void runSelfieCheck()}
              disabled={busy || webCameraOpening}
            />
            <Pressable
              accessibilityRole="button"
              onPress={closeGate}
              className={`mt-3 min-h-12 w-full items-center justify-center rounded-3xl border px-5 ${
                isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'
              }`}>
              <Text className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <SelfieNoticeModal notice={notice} onDismiss={dismissNotice} />
    </>
  );
}

function SelfieNoticeModal({ notice, onDismiss }: { notice: SelfieNotice | null; onDismiss: () => void }) {
  const { isDark } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const messageClass = isDark ? 'text-zinc-300' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const success = notice?.tone === 'success';

  return (
    <Modal transparent animationType="fade" visible={Boolean(notice)} onRequestClose={onDismiss}>
      <View className="flex-1 items-center justify-center bg-black/80 px-5">
        <View className={`w-full max-w-md rounded-[30px] border p-5 ${panelClass}`}>
          <View className={`mb-4 h-14 w-14 items-center justify-center rounded-full ${success ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            <Ionicons name={success ? 'checkmark' : 'alert'} size={26} color="#FFFFFF" />
          </View>
          <Text className={`text-2xl font-black ${titleClass}`}>{notice?.title}</Text>
          {notice?.message ? (
            <Text className={`mt-3 text-base leading-6 ${messageClass}`}>{notice.message}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            className={`mt-6 min-h-14 w-full items-center justify-center rounded-3xl px-5 ${success ? 'bg-emerald-500' : 'bg-violet'}`}>
            <Text className="text-base font-black text-white">OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function faceCheckMessage(result: SelfieFaceCheckResult) {
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
    return 'Face detection could not load on this browser. Check your connection and try again.';
  }

  return 'Take a fresh, clear selfie and try again.';
}

function waitForWebCamera(promise: Promise<MediaStream>) {
  return withTimeout(promise, 10_000, 'camera-timeout');
}

function waitForSelfieCheck(promise: Promise<SelfieFaceCheckResult>) {
  return withTimeout(promise, 8_000, 'face-check-timeout');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);

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
