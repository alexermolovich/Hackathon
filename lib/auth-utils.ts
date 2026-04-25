import type { User } from 'firebase/auth';
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
let pendingDemoPhoneNumber: string | null = null;

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

async function getWebAuthModule() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  return import('firebase/auth');
}

export async function signInWithGoogleFirebase(): Promise<GoogleAuthResult> {
  const auth = firebaseAuth;

  if (!auth) {
    return { ok: false, message: 'Add Firebase environment variables before using Google sign-in.' };
  }

  const authModule = await getWebAuthModule();

  if (!authModule?.GoogleAuthProvider || !authModule.signInWithPopup) {
    return { ok: false, message: 'Google sign-in is currently available on web only.' };
  }

  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await authModule.signInWithPopup(auth, provider);
    return { ok: true, user: result.user };
  } catch (error) {
    return { ok: false, message: getFirebaseErrorMessage(error) };
  }
}

export async function requestFirebasePhoneVerification(
  phoneNumber: string,
  _unusedVerifierId: string,
): Promise<PhoneAuthResult> {
  pendingDemoPhoneNumber = phoneNumber;

  return {
    ok: true,
    phone: phoneNumber,
    message: `Demo code: ${DEMO_PHONE_CODE}`,
  };
}

export async function confirmFirebasePhoneCode(token: string): Promise<PhoneAuthResult> {
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

