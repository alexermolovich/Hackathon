import { initializeApp, getApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

function createFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig) {
    return null;
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function createFirebaseAuth(app: FirebaseApp | null): Auth | null {
  if (!app) {
    return null;
  }

  try {
    return initializeAuth(app, {
      persistence: Platform.OS === 'web' && typeof window !== 'undefined' ? browserLocalPersistence : inMemoryPersistence,
    });
  } catch {
    return getAuth(app);
  }
}

export const firebaseApp = createFirebaseApp();
export const firebaseAuth = createFirebaseAuth(firebaseApp);
export const firebaseDb: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;

