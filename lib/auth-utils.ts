import type { ConfirmationResult, User } from 'firebase/auth';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  browserPopupRedirectResolver,
  linkWithPhoneNumber,
  signInWithPhoneNumber,
  signInWithPopup,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { firebaseAuth } from './firebase';

export type AuthActionResult = {
  ok: boolean;
  message?: string;
};

export type GoogleAuthResult = AuthActionResult & {
  user?: User | null;
};

export type PhoneAuthResult = AuthActionResult & {
  phone?: string;
  user?: User | null;
};

const phonePattern = /^\+[1-9]\d{7,14}$/;
const DEMO_PHONE_CODE = '123456';
const RECAPTCHA_CONTAINER_PREFIX = '__sidehustle_recaptcha_';
let pendingDemoPhoneNumber: string | null = null;
let pendingConfirmationResult: ConfirmationResult | null = null;
let recaptchaContainerCount = 0;

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('+')) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    return phonePattern.test(normalized) ? normalized : null;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return phonePattern.test(`+${digits}`) ? `+${digits}` : null;
}

function getFirebaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Firebase auth failed.';
}

function createRecaptchaContainer() {
  const div = document.createElement('div');
  div.id = `${RECAPTCHA_CONTAINER_PREFIX}${Date.now()}_${recaptchaContainerCount}`;
  recaptchaContainerCount += 1;
  div.setAttribute('aria-hidden', 'true');
  div.style.position = 'fixed';
  div.style.left = '0';
  div.style.top = '0';
  div.style.width = '1px';
  div.style.height = '1px';
  div.style.opacity = '0';
  div.style.overflow = 'hidden';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '-1';
  document.body.appendChild(div);
  return div;
}

export async function signInWithGoogleFirebase(): Promise<GoogleAuthResult> {
  const auth = firebaseAuth;

  if (!auth) {
    return { ok: false, message: 'Add Firebase environment variables before using Google sign-in.' };
  }

  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { ok: false, message: 'Google sign-in is currently available on web only.' };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    return { ok: true, user: result.user };
  } catch (error) {
    return { ok: false, message: getFirebaseErrorMessage(error) };
  }
}

export async function requestFirebasePhoneVerification(
  phoneNumber: string,
  _unusedVerifierId: string,
): Promise<PhoneAuthResult> {
  // Native: demo mode (real SMS requires expo-firebase-recaptcha)
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    pendingDemoPhoneNumber = phoneNumber;
    return { ok: true, phone: phoneNumber, message: `Demo code: ${DEMO_PHONE_CODE}` };
  }

  const auth = firebaseAuth;

  if (!auth) {
    return { ok: false, message: 'Firebase auth not configured.' };
  }

  try {
    pendingConfirmationResult = null;
    const recaptchaVerifier = new RecaptchaVerifier(auth, createRecaptchaContainer(), {
      size: 'invisible',
    });

    pendingConfirmationResult = auth.currentUser
      ? await linkWithPhoneNumber(auth.currentUser, phoneNumber, recaptchaVerifier)
      : await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return { ok: true, phone: phoneNumber };
  } catch (error) {
    return { ok: false, message: getFirebaseErrorMessage(error) };
  }
}

export async function confirmFirebasePhoneCode(token: string): Promise<PhoneAuthResult> {
  // Native: demo mode
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    if (!pendingDemoPhoneNumber) {
      return { ok: false, message: 'Request a phone verification code first.' };
    }
    if (token.trim() !== DEMO_PHONE_CODE) {
      return { ok: false, message: `Use the demo verification code ${DEMO_PHONE_CODE}.` };
    }
    const phone = pendingDemoPhoneNumber;
    pendingDemoPhoneNumber = null;
    return { ok: true, phone };
  }

  if (!pendingConfirmationResult) {
    return { ok: false, message: 'Request a phone verification code first.' };
  }

  try {
    const result = await pendingConfirmationResult.confirm(token.trim());
    pendingConfirmationResult = null;
    return { ok: true, user: result.user, phone: result.user.phoneNumber ?? undefined };
  } catch (error) {
    return { ok: false, message: getFirebaseErrorMessage(error) };
  }
}

