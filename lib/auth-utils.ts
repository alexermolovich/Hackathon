import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';

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
let recaptchaVerifier: RecaptchaVerifier | null = null;
let pendingPhoneConfirmation: ConfirmationResult | null = null;

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

function getRecaptchaVerifier(containerId: string) {
  const auth = firebaseAuth;

  if (!auth) {
    return null;
  }

  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });

  return recaptchaVerifier;
}

export async function signInWithGoogleFirebase(): Promise<GoogleAuthResult> {
  const auth = firebaseAuth;

  if (!auth) {
    return { ok: false, message: 'Add Firebase environment variables before using Google sign-in.' };
  }

  if (typeof window === 'undefined') {
    return { ok: false, message: 'Google sign-in needs a browser window.' };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    return { ok: true, user: result.user };
  } catch (error) {
    return { ok: false, message: getFirebaseErrorMessage(error) };
  }
}

export async function requestFirebasePhoneVerification(
  phoneNumber: string,
  recaptchaContainerId: string,
): Promise<PhoneAuthResult> {
  const auth = firebaseAuth;
  const user = auth?.currentUser ?? null;

  if (!auth || !user) {
    return { ok: false, message: 'Sign in with Google before verifying your phone.' };
  }

  if (user.phoneNumber === phoneNumber) {
    return { ok: true, phone: phoneNumber, user };
  }

  const verifier = getRecaptchaVerifier(recaptchaContainerId);

  if (!verifier) {
    return { ok: false, message: 'Firebase phone verification needs a browser reCAPTCHA container.' };
  }

  try {
    pendingPhoneConfirmation = await linkWithPhoneNumber(user, phoneNumber, verifier);
    return { ok: true, phone: phoneNumber };
  } catch (error) {
    recaptchaVerifier?.clear();
    recaptchaVerifier = null;
    return { ok: false, message: getFirebaseErrorMessage(error) };
  }
}

export async function confirmFirebasePhoneCode(token: string): Promise<PhoneAuthResult> {
  if (!pendingPhoneConfirmation) {
    return { ok: false, message: 'Request a phone verification code first.' };
  }

  try {
    const result = await pendingPhoneConfirmation.confirm(token);
    pendingPhoneConfirmation = null;

    return { ok: true, phone: result.user.phoneNumber ?? undefined, user: result.user };
  } catch (error) {
    return { ok: false, message: getFirebaseErrorMessage(error) };
  }
}

