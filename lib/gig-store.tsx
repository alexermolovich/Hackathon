import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  CHAT_UNLOCK_COST_BSTS,
  DAILY_REWARD_BSTS,
  MONTHLY_STREAK_BONUS_BSTS,
  SIGNUP_BONUS_BSTS,
  WEEKLY_STREAK_BONUS_BSTS,
} from './sidehustle-config';
import {
  currentUser as seededCurrentUser,
  matches as seededMatches,
  messages as seededMessages,
  profiles as seededProfiles,
  tasks as seededTasks,
} from './mock-data';
import { firebaseAuth, firebaseDb, hasFirebaseConfig } from './firebase';
import {
  confirmFirebasePhoneCode,
  normalizePhoneNumber,
  requestFirebasePhoneVerification,
  signInWithGoogleFirebase,
} from './auth-utils';
import type { Coordinates, EnrichedMatch, GigMatch, Message, Profile, Task } from './gig-types';
import { buildDeck, createUuid, enrichMatches } from './gig-utils';

type CreateTaskInput = {
  title: string;
  description: string;
  budget: number;
  category: string;
  location_label: string;
  date_window: string;
  is_boosted: boolean;
  boost_days: number;
  boost_cost_bsts: number;
  image_urls: string[];
};

type BidInput = {
  bidNote: string;
  counterBid: number;
  availabilityWindow: string;
};

type OnboardingInput = {
  username: string;
  phoneNumber: string;
  birthDate: string;
  bio: string;
  educationLevel: string;
  interests: string[];
  avatarUrl: string | null;
};

type StoreActionResult = {
  ok: boolean;
  message?: string;
};

type PhoneActionResult = StoreActionResult & {
  phone?: string;
};

type RewardResult = {
  amount: number;
  dailyStreak: number;
  weeklyBonus: boolean;
  monthlyBonus: boolean;
};

type GigStoreValue = {
  profile: Profile;
  profiles: Profile[];
  tasks: Task[];
  deck: Task[];
  matches: EnrichedMatch[];
  messages: Message[];
  isLiveMode: boolean;
  authLoading: boolean;
  authUserEmail: string | null;
  authUserName: string | null;
  isDark: boolean;
  colorMode: 'light' | 'dark';
  celebratedMatchId: string | null;
  createTask: (input: CreateTaskInput) => Promise<boolean>;
  submitBid: (task: Task, input: BidInput) => Promise<GigMatch>;
  submitMatchedBid: (task: Task, input: BidInput) => Promise<GigMatch>;
  likeBack: (matchId: string) => Promise<void>;
  unlockChat: (matchId: string) => Promise<boolean>;
  completeMatch: (matchId: string) => Promise<void>;
  sendMessage: (matchId: string, content: string) => Promise<void>;
  verifySelfie: (avatarUri: string) => Promise<void>;
  signInWithGoogle: () => Promise<StoreActionResult>;
  requestPhoneVerification: (phoneNumber: string) => Promise<PhoneActionResult>;
  confirmPhoneVerification: (phoneNumber: string, token: string) => Promise<PhoneActionResult>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  buyBsts: (amount: number) => void;
  claimConsistencyReward: () => RewardResult | null;
  updateRadius: (radius: number) => void;
  updateInterests: (interests: string[]) => void;
  updateLocation: (coords: Coordinates) => void;
  toggleColorMode: () => void;
  logout: () => void;
  clearCelebration: () => void;
};

const GigStoreContext = createContext<GigStoreValue | null>(null);
const TASK_LOCATION_MESSAGE_PREFIX = 'Gig location:';

function buildTaskMapsUrl(task: Task) {
  const { latitude, longitude } = task.location;
  return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function buildTaskLocationMessage(task: Task) {
  return `${TASK_LOCATION_MESSAGE_PREFIX} ${task.location_label} ${buildTaskMapsUrl(task)}`;
}

function dedupeLocationMessages(items: Message[]) {
  const seenLocationMessages = new Set<string>();

  return items.filter((message) => {
    if (!message.content.startsWith(TASK_LOCATION_MESSAGE_PREFIX)) {
      return true;
    }

    const key = `${message.match_id}:${message.sender_id}:${message.content}`;

    if (seenLocationMessages.has(key)) {
      return false;
    }

    seenLocationMessages.add(key);
    return true;
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function getAuthDisplayName(user: User) {
  return user.displayName || user.email || null;
}

function hasGoogleIdentity(user: User) {
  return user.providerData.some((identity) => identity.providerId === 'google.com');
}

function toIsoString(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return fallback;
}

function buildProfileFromAuthUser(user: User, current: Profile, row?: Record<string, unknown> | null): Profile {
  const rowLocation = row?.location as Record<string, unknown> | undefined;
  const authPhone = user.phoneNumber ?? '';
  const profilePhone = getString(row?.phone_number) || authPhone;
  const phoneVerified = Boolean(row?.phone_verified) || Boolean(user.phoneNumber && profilePhone);

  return {
    ...current,
    id: user.uid,
    username: getString(row?.username),
    avatar_url: getString(row?.avatar_url) || null,
    bio: getString(row?.bio),
    skills: Array.isArray(row?.skills) ? (row?.skills as string[]) : [],
    interests: Array.isArray(row?.interests) ? (row?.interests as string[]) : [],
    credits: getNumber(row?.credits, current.credits),
    location:
      typeof rowLocation?.latitude === 'number' && typeof rowLocation?.longitude === 'number'
        ? {
            latitude: rowLocation.latitude,
            longitude: rowLocation.longitude,
          }
        : current.location,
    search_radius: getNumber(row?.search_radius, current.search_radius),
    is_verified: Boolean(row?.is_verified),
    is_onboarded: Boolean(row?.is_onboarded),
    google_authenticated: hasGoogleIdentity(user),
    phone_number: profilePhone,
    phone_verified: phoneVerified,
    birth_date: getString(row?.birth_date),
    education_level: getString(row?.education_level) || null,
    accepted_terms_at: getString(row?.accepted_terms_at) || null,
    signup_bonus_awarded: Boolean(row?.signup_bonus_awarded),
    daily_streak: getNumber(row?.daily_streak, current.daily_streak),
    weekly_streak: getNumber(row?.weekly_streak, current.weekly_streak),
    monthly_streak: getNumber(row?.monthly_streak, current.monthly_streak),
    last_reward_claimed_at: getString(row?.last_reward_claimed_at) || null,
    vouch_count: getNumber(row?.vouch_count, current.vouch_count),
    posted_vouch_count: getNumber(row?.posted_vouch_count, current.posted_vouch_count),
    rating: getNumber(row?.rating, current.rating),
  };
}

export function GigProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [profile, setProfile] = useState<Profile>(seededCurrentUser);
  const [profiles, setProfiles] = useState<Profile[]>(seededProfiles);
  const [tasks, setTasks] = useState<Task[]>(seededTasks);
  const [matches, setMatches] = useState<GigMatch[]>(seededMatches);
  const [messages, setMessages] = useState<Message[]>(seededMessages);
  const [celebratedMatchId, setCelebratedMatchId] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(systemScheme === 'light' ? 'light' : 'dark');
  const [authLoading, setAuthLoading] = useState(hasFirebaseConfig);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [authUserName, setAuthUserName] = useState<string | null>(null);
  const isDark = colorMode === 'dark';

  const syncProfile = useCallback(
    (nextProfile: Profile) => {
      setProfile(nextProfile);
      setProfiles((current) =>
        current.some((item) => item.id === nextProfile.id)
          ? current.map((item) => (item.id === nextProfile.id ? nextProfile : item))
          : [nextProfile, ...current],
      );
    },
    [],
  );

  const applyAuthUser = useCallback(async (user: User) => {
    const displayName = getAuthDisplayName(user);
    let profileRow: Record<string, unknown> | null = null;

    setAuthUserEmail(user.email ?? null);
    setAuthUserName(displayName);

    if (firebaseDb) {
      try {
        const snapshot = await getDoc(doc(firebaseDb, 'profiles', user.uid));
        profileRow = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
      } catch {
        profileRow = null;
      }
    }

    setProfile((current) => {
      const nextProfile = buildProfileFromAuthUser(user, current, profileRow);

      setProfiles((currentProfiles) =>
        currentProfiles.some((item) => item.id === nextProfile.id)
          ? currentProfiles.map((item) => (item.id === nextProfile.id ? nextProfile : item))
          : [nextProfile, ...currentProfiles],
      );

      return nextProfile;
    });
  }, []);

  const requestCurrentLocation = useCallback(async () => {
    if (!hasFirebaseConfig) {
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setProfile((current) => ({ ...current, location: coords }));
      setProfiles((current) =>
        current.map((item) => (item.id === profile.id ? { ...item, location: coords } : item)),
      );
    } catch {
      // Seeded Rapid City coordinates keep the demo useful if location is unavailable.
    }
  }, [profile.id]);

  const mergeTasks = useCallback((existing: Task[], incoming: Task[]) => {
    const byId = new Map(existing.map((task) => [task.id, task]));
    incoming.forEach((task) => byId.set(task.id, task));
    return Array.from(byId.values());
  }, []);

  const mergeMatches = useCallback((existing: GigMatch[], incoming: GigMatch[]) => {
    const byId = new Map(existing.map((match) => [match.id, match]));
    incoming.forEach((match) => byId.set(match.id, match));
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, []);

  const mergeMessages = useCallback((existing: Message[], incoming: Message[]) => {
    const byId = new Map(existing.map((message) => [message.id, message]));
    incoming.forEach((message) => byId.set(message.id, message));
    const sorted = Array.from(byId.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return dedupeLocationMessages(sorted);
  }, []);

  const mapFirebaseTask = useCallback(
    (row: Record<string, unknown>): Task => ({
      id: String(row.id),
      poster_id: String(row.poster_id),
      title: String(row.title),
      description: String(row.description),
      budget: Number(row.budget),
      category: String(row.category),
      location_label: String(row.location_label ?? 'Rapid City area'),
      location: {
        latitude: Number(row.latitude ?? profile.location.latitude),
        longitude: Number(row.longitude ?? profile.location.longitude),
      },
      required_skills: Array.isArray(row.required_skills) ? (row.required_skills as string[]) : [],
      image_urls: Array.isArray(row.image_urls) ? (row.image_urls as string[]) : [],
      is_boosted: Boolean(row.is_boosted),
      boost_days: Number(row.boost_days ?? 0),
      boost_cost_bsts: Number(row.boost_cost_bsts ?? 0),
      date_window: String(row.date_window ?? ''),
      status: row.status === 'archived' ? 'archived' : 'open',
      created_at: toIsoString(row.created_at),
    }),
    [profile.location.latitude, profile.location.longitude],
  );

  const mapFirebaseMatch = useCallback(
    (row: Record<string, unknown>): GigMatch => ({
      id: String(row.id),
      task_id: String(row.task_id),
      doer_id: String(row.doer_id),
      bid_note: String(row.bid_note ?? ''),
      counter_bid: Number(row.counter_bid ?? 0),
      availability_window: String(row.availability_window ?? ''),
      is_unlocked: Boolean(row.is_unlocked),
      status: (row.status as GigMatch['status']) ?? 'pending',
      created_at: toIsoString(row.created_at),
    }),
    [],
  );

  const mapFirebaseMessage = useCallback(
    (row: Record<string, unknown>): Message => ({
      id: String(row.id),
      match_id: String(row.match_id),
      sender_id: String(row.sender_id),
      content: String(row.content ?? ''),
      created_at: toIsoString(row.created_at),
    }),
    [],
  );

  const hydrateMessages = useCallback(async () => {
    if (!firebaseDb) {
      return;
    }

    try {
      const snapshot = await getDocs(query(collection(firebaseDb, 'messages'), orderBy('created_at', 'asc')));
      setMessages(snapshot.docs.map((item) => mapFirebaseMessage({ id: item.id, ...item.data() })));
    } catch {
      // Keep current local messages on transient network errors.
    }
  }, [mapFirebaseMessage]);

  const hydrateFromFirebase = useCallback(
    async (nextProfile: Profile) => {
      if (!firebaseDb) {
        return;
      }

      try {
        const taskSnapshot = await getDocs(collection(firebaseDb, 'tasks'));
        const liveTasks = taskSnapshot.docs.map((item) => mapFirebaseTask({ id: item.id, ...item.data() }));

        if (liveTasks.length > 0) {
          setTasks((existing) => mergeTasks(existing, liveTasks));
        }
      } catch {
        // Mock data remains the first-run fallback for hackathon demos.
      }

      await hydrateMessages();
    },
    [hydrateMessages, mapFirebaseTask, mergeTasks],
  );

  useEffect(() => {
    const auth = firebaseAuth;

    if (!auth) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) {
        return;
      }

      if (user) {
        void applyAuthUser(user).finally(() => {
          if (active) {
            setAuthLoading(false);
          }
        });
      } else {
        setAuthUserEmail(null);
        setAuthUserName(null);
        setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyAuthUser]);

  useEffect(() => {
    void requestCurrentLocation();
  }, [requestCurrentLocation]);

  useEffect(() => {
    const database = firebaseDb;

    if (!hasFirebaseConfig || !database) {
      return;
    }

    const unsubscribeMatches = onSnapshot(collection(database, 'matches'), (snapshot) => {
      const incoming = snapshot.docs.map((item) => mapFirebaseMatch({ id: item.id, ...item.data() }));
      setMatches((current) => mergeMatches(current, incoming));

      incoming.forEach((nextMatch) => {
        if (nextMatch.status === 'matched' && nextMatch.doer_id === profile.id) {
          setCelebratedMatchId(nextMatch.id);
        }
      });
    });

    const unsubscribeMessages = onSnapshot(
      query(collection(database, 'messages'), orderBy('created_at', 'asc')),
      (snapshot) => {
        const incoming = snapshot.docs.map((item) => mapFirebaseMessage({ id: item.id, ...item.data() }));
        setMessages((current) => mergeMessages(current, incoming));
      },
    );

    void hydrateFromFirebase(profile);

    return () => {
      unsubscribeMatches();
      unsubscribeMessages();
    };
  }, [hydrateFromFirebase, mapFirebaseMatch, mapFirebaseMessage, mergeMatches, mergeMessages, profile]);

  const deck = useMemo(() => buildDeck(tasks, profile), [profile, tasks]);
  const enrichedMatches = useMemo(() => enrichMatches(matches, tasks, profiles), [matches, profiles, tasks]);

  async function createTask(input: CreateTaskInput) {
    if (input.boost_cost_bsts > profile.credits) {
      return false;
    }

    const task: Task = {
      id: createUuid(),
      poster_id: profile.id,
      title: input.title,
      description: input.description,
      budget: input.budget,
      category: input.category,
      location_label: input.location_label,
      location: profile.location,
      required_skills: [input.category],
      image_urls: input.image_urls,
      is_boosted: input.is_boosted,
      boost_days: input.boost_days,
      boost_cost_bsts: input.boost_cost_bsts,
      date_window: input.date_window,
      status: 'open',
      created_at: new Date().toISOString(),
    };

    setTasks((current) => [task, ...current]);

    if (input.boost_cost_bsts > 0) {
      const nextProfile = { ...profile, credits: profile.credits - input.boost_cost_bsts };
      syncProfile(nextProfile);
    }

    if (firebaseDb) {
      await setDoc(doc(firebaseDb, 'tasks', task.id), task);

      if (input.boost_cost_bsts > 0) {
        await setDoc(
          doc(firebaseDb, 'profiles', profile.id),
          { credits: profile.credits - input.boost_cost_bsts },
          { merge: true },
        );
      }
    }

    return true;
  }

  async function submitBid(task: Task, input: BidInput) {
    const match: GigMatch = {
      id: createUuid(),
      task_id: task.id,
      doer_id: profile.id,
      bid_note: input.bidNote.trim(),
      counter_bid: input.counterBid,
      availability_window: input.availabilityWindow.trim(),
      is_unlocked: false,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    setMatches((current) => [match, ...current]);

    if (firebaseDb) {
      await setDoc(doc(firebaseDb, 'matches', match.id), match);
    }

    return match;
  }

  async function submitMatchedBid(task: Task, input: BidInput) {
    const match: GigMatch = {
      id: createUuid(),
      task_id: task.id,
      doer_id: profile.id,
      bid_note: input.bidNote.trim(),
      counter_bid: input.counterBid,
      availability_window: input.availabilityWindow.trim(),
      is_unlocked: false,
      status: 'matched',
      created_at: new Date().toISOString(),
    };

    setMatches((current) => [match, ...current]);
    setCelebratedMatchId(match.id);

    if (firebaseDb) {
      await setDoc(doc(firebaseDb, 'matches', match.id), match);
    }

    return match;
  }

  async function likeBack(matchId: string) {
    setMatches((current) =>
      current.map((match) => (match.id === matchId ? { ...match, status: 'matched' } : match)),
    );
    setCelebratedMatchId(matchId);

    if (firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        status: 'matched',
        updated_at: new Date().toISOString(),
      });
    }
  }

  async function unlockChat(matchId: string) {
    if (profile.credits < CHAT_UNLOCK_COST_BSTS) {
      return false;
    }

    const match = matches.find((item) => item.id === matchId);
    const task = match ? tasks.find((item) => item.id === match.task_id) : undefined;
    const locationMessageContent = task ? buildTaskLocationMessage(task) : null;
    const hasLocationMessage = locationMessageContent
      ? messages.some(
          (message) =>
            message.match_id === matchId &&
            message.sender_id === task?.poster_id &&
            message.content === locationMessageContent,
        )
      : false;
    const locationMessage: Message | null =
      task && locationMessageContent && !hasLocationMessage
        ? {
            id: createUuid(),
            match_id: matchId,
            sender_id: task.poster_id,
            content: locationMessageContent,
            created_at: new Date().toISOString(),
          }
        : null;

    syncProfile({ ...profile, credits: profile.credits - CHAT_UNLOCK_COST_BSTS });
    setMatches((current) =>
      current.map((matchItem) => (matchItem.id === matchId ? { ...matchItem, is_unlocked: true } : matchItem)),
    );

    if (locationMessage) {
      setMessages((current) =>
        current.some(
          (message) =>
            message.match_id === locationMessage.match_id &&
            message.sender_id === locationMessage.sender_id &&
            message.content === locationMessage.content,
        )
          ? current
          : mergeMessages(current, [locationMessage]),
      );
    }

    if (firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        is_unlocked: true,
        updated_at: new Date().toISOString(),
      });
      await setDoc(
        doc(firebaseDb, 'profiles', profile.id),
        { credits: profile.credits - CHAT_UNLOCK_COST_BSTS },
        { merge: true },
      );

      if (locationMessage) {
        await setDoc(doc(firebaseDb, 'messages', locationMessage.id), locationMessage);
      }
    }

    return true;
  }

  async function completeMatch(matchId: string) {
    const match = matches.find((item) => item.id === matchId);
    const task = match ? tasks.find((item) => item.id === match.task_id) : undefined;

    setMatches((current) =>
      current.map((item) => (item.id === matchId ? { ...item, status: 'completed' } : item)),
    );

    if (task) {
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, status: 'archived' } : item)),
      );
    }

    if (match) {
      setProfiles((current) =>
        current.map((item) => {
          if (item.id === match.doer_id) {
            return { ...item, vouch_count: item.vouch_count + 1 };
          }

          if (task && item.id === task.poster_id) {
            return { ...item, posted_vouch_count: item.posted_vouch_count + 1 };
          }

          return item;
        }),
      );
      setProfile((current) => {
        if (current.id === match.doer_id) {
          return { ...current, vouch_count: current.vouch_count + 1 };
        }

        if (task && current.id === task.poster_id) {
          return { ...current, posted_vouch_count: current.posted_vouch_count + 1 };
        }

        return current;
      });
    }

    if (firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        status: 'completed',
        updated_at: new Date().toISOString(),
      });

      if (task) {
        await updateDoc(doc(firebaseDb, 'tasks', task.id), {
          status: 'archived',
          updated_at: new Date().toISOString(),
        });
        await setDoc(
          doc(firebaseDb, 'profiles', task.poster_id),
          { posted_vouch_count: increment(1) },
          { merge: true },
        );
      }

      if (match) {
        await setDoc(doc(firebaseDb, 'profiles', match.doer_id), { vouch_count: increment(1) }, { merge: true });
      }
    }
  }

  async function sendMessage(matchId: string, content: string) {
    const trimmed = content.trim();

    if (!trimmed) {
      return;
    }

    const message: Message = {
      id: createUuid(),
      match_id: matchId,
      sender_id: profile.id,
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, message]);

    if (firebaseDb) {
      await setDoc(doc(firebaseDb, 'messages', message.id), message);
    }
  }

  async function verifySelfie(avatarUri: string) {
    const nextProfile = {
      ...profile,
      avatar_url: avatarUri,
      is_verified: true,
    };

    syncProfile(nextProfile);

    if (firebaseDb) {
      await setDoc(
        doc(firebaseDb, 'profiles', profile.id),
        { avatar_url: avatarUri, is_verified: true },
        { merge: true },
      );
    }
  }

  async function signInWithGoogle(): Promise<StoreActionResult> {
    setAuthLoading(true);

    try {
      const result = await signInWithGoogleFirebase();
      const user = result.user ?? null;

      if (!result.ok || !user) {
        return {
          ok: false,
          message: result.message ?? 'Google sign-in did not return a Firebase user.',
        };
      }

      await applyAuthUser(user);

      return { ok: true };
    } finally {
      setAuthLoading(false);
    }
  }

  async function requestPhoneVerification(phoneNumber: string): Promise<PhoneActionResult> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      return { ok: false, message: 'Enter a valid phone number, including area code.' };
    }

    return requestFirebasePhoneVerification(normalizedPhone, 'firebase-recaptcha-container');
  }

  async function confirmPhoneVerification(phoneNumber: string, token: string): Promise<PhoneActionResult> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const normalizedToken = token.trim();

    if (!normalizedPhone) {
      return { ok: false, message: 'Enter a valid phone number, including area code.' };
    }

    if (!/^\d{6}$/.test(normalizedToken)) {
      return { ok: false, message: 'Enter the 6-digit verification code.' };
    }

    const result = await confirmFirebasePhoneCode(normalizedToken);

    if (!result.ok) {
      return result;
    }

    const user = result.user ?? firebaseAuth?.currentUser ?? null;
    const verifiedPhone = result.phone ?? normalizedPhone;
    const nextProfile = {
      ...profile,
      id: user?.uid ?? profile.id,
      phone_number: verifiedPhone,
      phone_verified: true,
      google_authenticated: true,
    };

    syncProfile(nextProfile);

    if (user) {
      await applyAuthUser(user);
    }

    if (firebaseDb) {
      await setDoc(
        doc(firebaseDb, 'profiles', user?.uid ?? profile.id),
        {
          username: profile.username,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          skills: profile.skills,
          interests: profile.interests,
          credits: profile.credits,
          search_radius: profile.search_radius,
          is_verified: profile.is_verified,
          is_onboarded: profile.is_onboarded,
          google_authenticated: true,
          phone_number: verifiedPhone,
          phone_verified: true,
          birth_date: profile.birth_date || null,
          education_level: profile.education_level,
          accepted_terms_at: profile.accepted_terms_at,
          signup_bonus_awarded: profile.signup_bonus_awarded,
        },
        { merge: true },
      );
    }

    return { ok: true, phone: verifiedPhone };
  }

  async function completeOnboarding(input: OnboardingInput) {
    const shouldAwardSignup = !profile.signup_bonus_awarded;
    const now = new Date().toISOString();
    const nextProfile: Profile = {
      ...profile,
      username: input.username.trim(),
      phone_number: input.phoneNumber.trim(),
      birth_date: input.birthDate,
      bio: input.bio.trim(),
      education_level: input.educationLevel,
      interests: input.interests,
      skills: input.interests,
      avatar_url: input.avatarUrl,
      google_authenticated: true,
      phone_verified: true,
      is_verified: Boolean(input.avatarUrl),
      is_onboarded: true,
      accepted_terms_at: now,
      signup_bonus_awarded: true,
      credits: profile.credits + (shouldAwardSignup ? SIGNUP_BONUS_BSTS : 0),
    };

    syncProfile(nextProfile);

    if (firebaseDb) {
      await setDoc(
        doc(firebaseDb, 'profiles', nextProfile.id),
        {
          ...nextProfile,
          is_onboarded: true,
          google_authenticated: true,
          phone_verified: true,
        },
        { merge: true },
      );
    }
  }

  function buyBsts(amount: number) {
    syncProfile({ ...profile, credits: profile.credits + amount });
  }

  function claimConsistencyReward() {
    const claimedAt = profile.last_reward_claimed_at;

    if (claimedAt?.slice(0, 10) === todayKey()) {
      return null;
    }

    const nextDailyStreak = profile.daily_streak + 1;
    const weeklyBonus = nextDailyStreak % 7 === 0;
    const monthlyBonus = nextDailyStreak % 30 === 0;
    const amount =
      DAILY_REWARD_BSTS +
      (weeklyBonus ? WEEKLY_STREAK_BONUS_BSTS : 0) +
      (monthlyBonus ? MONTHLY_STREAK_BONUS_BSTS : 0);

    syncProfile({
      ...profile,
      credits: profile.credits + amount,
      daily_streak: nextDailyStreak,
      weekly_streak: weeklyBonus ? profile.weekly_streak + 1 : profile.weekly_streak,
      monthly_streak: monthlyBonus ? profile.monthly_streak + 1 : profile.monthly_streak,
      last_reward_claimed_at: new Date().toISOString(),
    });

    return {
      amount,
      dailyStreak: nextDailyStreak,
      weeklyBonus,
      monthlyBonus,
    };
  }

  function updateRadius(radius: number) {
    const nextRadius = Math.min(100, Math.max(1, Math.round(radius)));
    const nextProfile = { ...profile, search_radius: nextRadius };
    syncProfile(nextProfile);
  }

  function updateInterests(interests: string[]) {
    const nextProfile = { ...profile, interests, skills: interests };
    syncProfile(nextProfile);
  }

  function updateLocation(coords: Coordinates) {
    const nextProfile = { ...profile, location: coords };
    syncProfile(nextProfile);
  }

  function toggleColorMode() {
    setColorMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  function logout() {
    if (firebaseAuth) {
      void firebaseAuth.signOut();
    }

    setAuthUserEmail(null);
    setAuthUserName(null);
    syncProfile({
      ...seededCurrentUser,
      location: profile.location,
      search_radius: profile.search_radius,
    });
  }

  const value: GigStoreValue = {
    profile,
    profiles,
    tasks,
    deck,
    matches: enrichedMatches,
    messages,
    isLiveMode: hasFirebaseConfig,
    authLoading,
    authUserEmail,
    authUserName,
    isDark,
    colorMode,
    celebratedMatchId,
    createTask,
    submitBid,
    submitMatchedBid,
    likeBack,
    unlockChat,
    completeMatch,
    sendMessage,
    verifySelfie,
    signInWithGoogle,
    requestPhoneVerification,
    confirmPhoneVerification,
    completeOnboarding,
    buyBsts,
    claimConsistencyReward,
    updateRadius,
    updateInterests,
    updateLocation,
    toggleColorMode,
    logout,
    clearCelebration: () => setCelebratedMatchId(null),
  };

  return <GigStoreContext.Provider value={value}>{children}</GigStoreContext.Provider>;
}

export function useGigStore() {
  const context = useContext(GigStoreContext);

  if (!context) {
    throw new Error('useGigStore must be used inside GigProvider');
  }

  return context;
}
