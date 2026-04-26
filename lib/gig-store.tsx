import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { defaultProfile } from './default-profile';
import { demoBypassProfiles } from './demo-bypass-profiles';
import {
  CHAT_UNLOCK_COST_BSTS,
  SEE_MORE_BIDDERS_COST_BSTS,
  SIGNUP_BONUS_BSTS,
} from './sidehustle-config';
import { firebaseAuth, firebaseDb, hasFirebaseConfig } from './firebase';
import {
  confirmFirebasePhoneCode,
  normalizePhoneNumber,
  requestFirebasePhoneVerification,
  signInWithGoogleFirebase,
} from './auth-utils';
import type { AiTaskMatchProfile, AiUserMatchProfile, Coordinates, EnrichedMatch, GigMatch, Message, Profile, Task } from './gig-types';
import {
  buildTaskAiMatchProfile,
  buildUserAiMatchProfile,
  createProfileAiProfileSignature,
  createTaskAiProfileSignature,
  getTaskSafety,
  rankDeckTasks,
  shouldRefreshProfileAiProfile,
} from './ai-matching';
import { createUuid, enrichMatches, milesBetween } from './gig-utils';
import { isTransientImageRef, toPublicAvatarRef, toShareableImageRefs } from './repo-images';

type CreateTaskInput = {
  title: string;
  description: string;
  budget: number;
  category: string;
  requiredSkills: string[];
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

type UpdateTaskInput = CreateTaskInput & {
  status: Task['status'];
};

type OnboardingInput = {
  username: string;
  phoneNumber: string;
  birthDate: string;
  bio: string;
  educationLevel: string;
  interests: string[];
  avatarUrl: string | null;
  selfieVerified: boolean;
};

type ProfileUpdateInput = Partial<
  Pick<
    Profile,
    | 'username'
    | 'bio'
    | 'skills'
    | 'interests'
    | 'google_authenticated'
    | 'phone_number'
    | 'phone_verified'
    | 'birth_date'
    | 'education_level'
    | 'accepted_terms_at'
    | 'avatar_url'
  >
>;

type StoreActionResult = {
  ok: boolean;
  message?: string;
};

type TaskSaveResult = StoreActionResult & {
  reason?: 'insufficient_credits' | 'unsafe_content';
};

type PhoneActionResult = StoreActionResult & {
  phone?: string;
};

type GigStoreValue = {
  profile: Profile;
  profiles: Profile[];
  tasks: Task[];
  deck: Task[];
  matches: EnrichedMatch[];
  messages: Message[];
  isLiveMode: boolean;
  authBypassActive: boolean;
  authBypassProfiles: Profile[];
  isAccountReady: boolean;
  authLoading: boolean;
  authUserEmail: string | null;
  authUserName: string | null;
  isDark: boolean;
  colorMode: 'light' | 'dark';
  swipedTaskCount: number;
  createTask: (input: CreateTaskInput) => Promise<TaskSaveResult>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<TaskSaveResult>;
  deleteTask: (taskId: string) => Promise<StoreActionResult>;
  submitBid: (task: Task, input: BidInput) => Promise<GigMatch>;
  submitMatchedBid: (task: Task, input: BidInput) => Promise<GigMatch>;
  likeBack: (matchId: string) => Promise<void>;
  unlockChat: (matchId: string) => Promise<boolean>;
  unlockAllBidders: () => Promise<boolean>;
  requestMatchCompletion: (matchId: string) => Promise<void>;
  completeMatch: (matchId: string) => Promise<void>;
  rateMatch: (matchId: string, rating: number) => Promise<boolean>;
  sendMessage: (matchId: string, content: string) => Promise<void>;
  markCounterBidsSeen: (matchIds: string[]) => Promise<void>;
  markAcceptedOffersSeen: (matchIds: string[]) => Promise<void>;
  markMessagesRead: (matchId: string) => Promise<void>;
  verifySelfie: (avatarUri: string) => Promise<void>;
  startPhoneOnlyAuth: () => StoreActionResult;
  signInWithGoogle: () => Promise<StoreActionResult>;
  signInWithAuthBypass: (profileId: string) => Promise<StoreActionResult>;
  requestPhoneVerification: (phoneNumber: string) => Promise<PhoneActionResult>;
  confirmPhoneVerification: (phoneNumber: string, token: string) => Promise<PhoneActionResult>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  updateProfileDetails: (input: ProfileUpdateInput) => Promise<void>;
  buyBsts: (amount: number) => void;
  updateRadius: (radius: number) => void;
  updateInterests: (interests: string[]) => void;
  updateLocation: (coords: Coordinates) => void;
  toggleColorMode: () => void;
  logout: () => void;
  rememberSwipedTask: (taskId: string) => void;
  clearSwipeContext: () => void;
};

const GigStoreContext = createContext<GigStoreValue | null>(null);
const TASK_LOCATION_MESSAGE_PREFIX = 'Gig location:';
const SWIPE_CONTEXT_STORAGE_PREFIX = 'sidehustle:swipe-context:';
const PROFILE_AI_REFRESH_DEBOUNCE_MS = 1400;

function swipeContextStorageKey(profileId: string) {
  return `${SWIPE_CONTEXT_STORAGE_PREFIX}${profileId}`;
}

function dedupeLocationMessages(items: Message[]) {
  return items.filter((message) => !message.content.startsWith(TASK_LOCATION_MESSAGE_PREFIX));
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function getOptionalNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function getAvatarRef(value: unknown, fallback: string | null) {
  const avatarRef = getString(value) || fallback;
  return avatarRef && isTransientImageRef(avatarRef) ? null : avatarRef;
}

function normalizeRating(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function applyReceivedRating(profile: Profile, rating: number, previousRating: number | null) {
  const count = Math.max(0, profile.rating_count);

  if (previousRating !== null && count > 0) {
    return {
      ...profile,
      rating: (profile.rating * count - previousRating + rating) / count,
    };
  }

  const nextCount = count + 1;

  return {
    ...profile,
    rating: (profile.rating * count + rating) / nextCount,
    rating_count: nextCount,
  };
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

function getCoordinates(value: unknown, fallback: Coordinates): Coordinates {
  const rowLocation = value as Record<string, unknown> | undefined;
  const latitude = getNumber(rowLocation?.latitude, Number.NaN);
  const longitude = getNumber(rowLocation?.longitude, Number.NaN);

  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : fallback;
}

function getOptionalCoordinates(value: unknown): Coordinates | null {
  const rowLocation = value as Record<string, unknown> | undefined;
  const latitude = getNumber(rowLocation?.latitude, Number.NaN);
  const longitude = getNumber(rowLocation?.longitude, Number.NaN);

  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function getTaskAiMatchProfile(value: unknown): AiTaskMatchProfile | null {
  const row = value as Partial<AiTaskMatchProfile> | undefined;

  if (!row || typeof row !== 'object' || !row.summary) {
    return null;
  }

  return {
    source: row.source === 'ai' ? 'ai' : 'local',
    summary: getString(row.summary),
    concepts: getStringArray(row.concepts),
    semantic_categories: getStringArray(row.semantic_categories),
    safety: {
      status: row.safety?.status === 'blocked' || row.safety?.status === 'review' ? row.safety.status : 'safe',
      reasons: getStringArray(row.safety?.reasons),
    },
    generated_at: getString(row.generated_at) || new Date().toISOString(),
  };
}

function getUserAiMatchProfile(value: unknown): AiUserMatchProfile | null {
  const row = value as Partial<AiUserMatchProfile> | undefined;

  if (!row || typeof row !== 'object' || !row.summary) {
    return null;
  }

  return {
    source: row.source === 'ai' ? 'ai' : 'local',
    summary: getString(row.summary),
    concepts: getStringArray(row.concepts),
    preferred_categories: getStringArray(row.preferred_categories),
    generated_at: getString(row.generated_at) || new Date().toISOString(),
  };
}

function buildProfileFromRow(id: string, row?: Record<string, unknown> | null, current = defaultProfile): Profile {
  const rowLocation = row?.location as Record<string, unknown> | undefined;

  return {
    ...current,
    id,
    username: getString(row?.username) || current.username,
    avatar_url: getAvatarRef(row?.avatar_url, current.avatar_url),
    bio: getString(row?.bio) || current.bio,
    skills: getStringArray(row?.skills).length > 0 ? getStringArray(row?.skills) : current.skills,
    interests: getStringArray(row?.interests).length > 0 ? getStringArray(row?.interests) : current.interests,
    credits: getNumber(row?.credits, current.credits),
    location:
      typeof rowLocation?.latitude === 'number' && typeof rowLocation?.longitude === 'number'
        ? {
            latitude: rowLocation.latitude,
            longitude: rowLocation.longitude,
          }
        : current.location,
    search_radius: getNumber(row?.search_radius, current.search_radius),
    is_verified: Boolean(row?.is_verified) || current.is_verified,
    is_onboarded: Boolean(row?.is_onboarded) || current.is_onboarded,
    google_authenticated: Boolean(row?.google_authenticated) || current.google_authenticated,
    phone_number: getString(row?.phone_number) || current.phone_number,
    phone_verified: Boolean(row?.phone_verified) || current.phone_verified,
    birth_date: getString(row?.birth_date) || current.birth_date,
    education_level: getString(row?.education_level) || current.education_level,
    accepted_terms_at: getString(row?.accepted_terms_at) || current.accepted_terms_at,
    signup_bonus_awarded: Boolean(row?.signup_bonus_awarded) || current.signup_bonus_awarded,
    bidder_access_unlocked_at: getString(row?.bidder_access_unlocked_at) || null,
    vouch_count: getNumber(row?.vouch_count, current.vouch_count),
    posted_vouch_count: getNumber(row?.posted_vouch_count, current.posted_vouch_count),
    rating: getNumber(row?.rating, current.rating),
    rating_count: getNumber(row?.rating_count, current.rating_count),
    ai_match_profile: getUserAiMatchProfile(row?.ai_match_profile) ?? current.ai_match_profile,
    ai_match_profile_signature: getString(row?.ai_match_profile_signature) || current.ai_match_profile_signature,
    ai_match_profile_location: getOptionalCoordinates(row?.ai_match_profile_location) ?? current.ai_match_profile_location,
    ai_match_profile_updated_at: getString(row?.ai_match_profile_updated_at) || current.ai_match_profile_updated_at,
  };
}

function buildProfileFromAuthUser(user: User, current: Profile, row?: Record<string, unknown> | null): Profile {
  const profileFromRow = buildProfileFromRow(user.uid, row, current);
  const authPhone = user.phoneNumber ?? '';
  const profilePhone = profileFromRow.phone_number || authPhone;

  return {
    ...profileFromRow,
    google_authenticated: hasGoogleIdentity(user) || profileFromRow.google_authenticated,
    phone_number: profilePhone,
    phone_verified: profileFromRow.phone_verified || Boolean(user.phoneNumber && profilePhone),
  };
}

function isProfileAppReady(profile: Profile) {
  return Boolean(
    profile.google_authenticated &&
      profile.phone_verified &&
      profile.is_onboarded &&
      profile.username.trim() &&
      profile.bio.trim() &&
      profile.birth_date &&
      profile.education_level &&
      profile.accepted_terms_at &&
      profile.interests.length >= 5,
  );
}

function buildPrivateProfileRecord(profile: Profile) {
  return {
    username: profile.username,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    skills: profile.skills,
    interests: profile.interests,
    credits: profile.credits,
    location: profile.location,
    search_radius: profile.search_radius,
    is_verified: profile.is_verified,
    is_onboarded: profile.is_onboarded,
    google_authenticated: profile.google_authenticated,
    phone_number: profile.phone_number,
    phone_verified: profile.phone_verified,
    birth_date: profile.birth_date,
    education_level: profile.education_level,
    accepted_terms_at: profile.accepted_terms_at,
    signup_bonus_awarded: profile.signup_bonus_awarded,
    bidder_access_unlocked_at: profile.bidder_access_unlocked_at,
    vouch_count: profile.vouch_count,
    posted_vouch_count: profile.posted_vouch_count,
    rating: profile.rating,
    rating_count: profile.rating_count,
    ai_match_profile: profile.ai_match_profile,
    ai_match_profile_signature: profile.ai_match_profile_signature,
    ai_match_profile_location: profile.ai_match_profile_location,
    ai_match_profile_updated_at: profile.ai_match_profile_updated_at,
    updated_at: new Date().toISOString(),
  };
}

function buildPublicProfileRecord(profile: Profile) {
  return {
    username: profile.username,
    avatar_url: toPublicAvatarRef(profile.avatar_url),
    bio: profile.bio,
    skills: profile.skills,
    interests: profile.interests,
    location: null,
    search_radius: profile.search_radius,
    is_verified: profile.is_verified,
    is_onboarded: profile.is_onboarded,
    google_authenticated: profile.google_authenticated,
    phone_verified: profile.phone_verified,
    vouch_count: profile.vouch_count,
    posted_vouch_count: profile.posted_vouch_count,
    rating: profile.rating,
    rating_count: profile.rating_count,
    ai_match_profile: profile.ai_match_profile,
    ai_match_profile_signature: profile.ai_match_profile_signature,
    ai_match_profile_location: null,
    ai_match_profile_updated_at: profile.ai_match_profile_updated_at,
    updated_at: new Date().toISOString(),
  };
}

function mergeProfilesById(items: Profile[]) {
  const byId = new Map<string, Profile>();

  items.forEach((item) => {
    if (item.id && item.username.trim()) {
      byId.set(item.id, item);
    }
  });

  return Array.from(byId.values()).sort((left, right) => left.username.localeCompare(right.username));
}

function asBypassReadyProfile(profile: Profile): Profile {
  const fallbackCategories = ['Tech Setup', 'Cleaning', 'Organizing', 'Moving', 'Events'];
  const interests = profile.interests.length >= 5 ? profile.interests : mergeStringLists(profile.interests, profile.skills, fallbackCategories).slice(0, 5);
  const skills = profile.skills.length > 0 ? profile.skills : interests;

  return {
    ...defaultProfile,
    ...profile,
    username: profile.username.trim() || 'Demo Hustler',
    avatar_url: profile.avatar_url ?? 'repo://demo/avatars/demo-hustler.png',
    bio: profile.bio.trim() || 'Demo bypass account for testing SideHustle.',
    skills,
    interests,
    credits: profile.credits || 550,
    phone_number: profile.phone_number || '+16055550100',
    phone_verified: true,
    birth_date: profile.birth_date || '1995-06-15',
    education_level: profile.education_level || 'Some college',
    accepted_terms_at: profile.accepted_terms_at || new Date().toISOString(),
    signup_bonus_awarded: true,
    google_authenticated: true,
    is_onboarded: true,
  };
}

function mergeStringLists(...lists: string[][]) {
  return Array.from(new Set(lists.flat().map((item) => item.trim()).filter(Boolean)));
}

function buildMatchRecord(match: GigMatch, task: Task | undefined) {
  const posterId = task?.poster_id ?? '';
  const participantIds = Array.from(new Set([posterId, match.doer_id].filter(Boolean)));

  return {
    ...match,
    poster_id: posterId,
    participant_ids: participantIds,
    updated_at: new Date().toISOString(),
  };
}

function buildMessageRecord(message: Message, match: GigMatch | undefined, task: Task | undefined) {
  const posterId = task?.poster_id ?? '';
  const participantIds = Array.from(new Set([posterId, match?.doer_id, message.sender_id].filter(Boolean)));

  return {
    ...message,
    task_id: match?.task_id ?? '',
    participant_ids: participantIds,
  };
}

export function GigProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [profiles, setProfiles] = useState<Profile[]>([defaultProfile]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [matches, setMatches] = useState<GigMatch[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [swipedTaskIds, setSwipedTaskIds] = useState<string[]>([]);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(systemScheme === 'light' ? 'light' : 'dark');
  const [authBypassActive, setAuthBypassActive] = useState(false);
  const [authBypassProfiles, setAuthBypassProfiles] = useState<Profile[]>(demoBypassProfiles);
  const [authLoading, setAuthLoading] = useState(hasFirebaseConfig);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [authUserName, setAuthUserName] = useState<string | null>(null);
  const isDark = colorMode === 'dark';
  const profileRef = useRef(profile);
  const profileAiRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileAiRefreshRunIdRef = useRef(0);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(
    () => () => {
      clearProfileAiRefreshTimeout();
    },
    [],
  );

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

  const persistProfile = useCallback(
    async (nextProfile: Profile) => {
      if (!firebaseDb || authBypassActive || !nextProfile.google_authenticated) {
        return;
      }

      await setDoc(doc(firebaseDb, 'profiles', nextProfile.id), buildPrivateProfileRecord(nextProfile), { merge: true });

      if (nextProfile.is_onboarded && nextProfile.username.trim()) {
        await setDoc(doc(firebaseDb, 'public_profiles', nextProfile.id), buildPublicProfileRecord(nextProfile), {
          merge: true,
        });
      }
    },
    [authBypassActive],
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

      void persistProfile(nextProfile);

      return nextProfile;
    });
  }, [persistProfile]);

  const requestCurrentLocation = useCallback(async () => {
    if (!hasFirebaseConfig || authBypassActive) {
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
      const currentProfile = profileRef.current;
      const nextProfile = { ...currentProfile, location: coords };

      syncProfile(nextProfile);

      if (!authBypassActive && firebaseDb && currentProfile.google_authenticated) {
        await persistProfile(nextProfile);
        scheduleProfileAiRefresh(600);
      }
    } catch {
      // Rapid City defaults keep distance filters usable if location is unavailable.
    }
  }, [authBypassActive, persistProfile, syncProfile]);

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
    (row: Record<string, unknown>): Task => {
      const legacyLocation = {
        latitude: getNumber(row.latitude, profile.location.latitude),
        longitude: getNumber(row.longitude, profile.location.longitude),
      };

      return {
        id: String(row.id),
        poster_id: getString(row.poster_id),
        title: getString(row.title),
        description: getString(row.description),
        budget: getNumber(row.budget, 0),
        category: getString(row.category),
        location_label: getString(row.location_label) || 'Rapid City area',
        location: getCoordinates(row.location, legacyLocation),
        required_skills: getStringArray(row.required_skills),
        image_urls: getStringArray(row.image_urls),
        is_boosted: Boolean(row.is_boosted),
        boost_days: getNumber(row.boost_days, 0),
        boost_cost_bsts: getNumber(row.boost_cost_bsts, 0),
        date_window: getString(row.date_window),
        status: row.status === 'archived' ? 'archived' : 'open',
        created_at: toIsoString(row.created_at),
        ai_match_profile: getTaskAiMatchProfile(row.ai_match_profile),
        ai_match_profile_signature: getString(row.ai_match_profile_signature) || null,
        ai_match_profile_updated_at: getString(row.ai_match_profile_updated_at) || null,
      };
    },
    [profile.location.latitude, profile.location.longitude],
  );

  const mapFirebaseMatch = useCallback(
    (row: Record<string, unknown>): GigMatch => {
      const status = row.status === 'matched' || row.status === 'completed' ? row.status : 'pending';

      return {
        id: String(row.id),
        task_id: getString(row.task_id),
        doer_id: getString(row.doer_id),
        bid_note: getString(row.bid_note),
        counter_bid: getNumber(row.counter_bid, 0),
        availability_window: getString(row.availability_window),
        is_unlocked: Boolean(row.is_unlocked),
        status,
        doer_rating_by_poster: getOptionalNumber(row.doer_rating_by_poster),
        poster_rating_by_doer: getOptionalNumber(row.poster_rating_by_doer),
        poster_seen_counter_at: getString(row.poster_seen_counter_at) || null,
        doer_seen_match_at: getString(row.doer_seen_match_at) || null,
        poster_read_messages_at: getString(row.poster_read_messages_at) || null,
        doer_read_messages_at: getString(row.doer_read_messages_at) || null,
        doer_completed_at: getString(row.doer_completed_at) || null,
        poster_completed_at: getString(row.poster_completed_at) || null,
        created_at: toIsoString(row.created_at),
      };
    },
    [],
  );

  const mapFirebaseMessage = useCallback(
    (row: Record<string, unknown>): Message => ({
      id: String(row.id),
      match_id: getString(row.match_id),
      sender_id: getString(row.sender_id),
      content: getString(row.content),
      created_at: toIsoString(row.created_at),
    }),
    [],
  );

  const mapFirebaseProfile = useCallback((id: string, row: Record<string, unknown>): Profile => {
    const { location: _location, ...publicRow } = row;
    return buildProfileFromRow(id, publicRow);
  }, []);

  useEffect(() => {
    const database = firebaseDb;

    if (!hasFirebaseConfig || !database) {
      setAuthBypassProfiles(demoBypassProfiles);
      return;
    }

    return onSnapshot(
      collection(database, 'public_profiles'),
      (snapshot) => {
        const publicProfiles = snapshot.docs
          .map((item) => asBypassReadyProfile(buildProfileFromRow(item.id, item.data() as Record<string, unknown>)))
          .filter((item) => item.username.trim());

        setAuthBypassProfiles(mergeProfilesById([...publicProfiles, ...demoBypassProfiles]));
      },
      () => {
        setAuthBypassProfiles(demoBypassProfiles);
      },
    );
  }, []);

  useEffect(() => {
    const auth = firebaseAuth;

    if (authBypassActive) {
      setAuthLoading(false);
      return;
    }

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
  }, [applyAuthUser, authBypassActive]);

  useEffect(() => {
    void requestCurrentLocation();
  }, [requestCurrentLocation]);

  useEffect(() => {
    let active = true;

    setSwipedTaskIds([]);

    void AsyncStorage.getItem(swipeContextStorageKey(profile.id))
      .then((storedValue) => {
        if (!active || !storedValue) {
          return;
        }

        const parsed = JSON.parse(storedValue) as unknown;
        const ids = getStringArray(parsed);
        setSwipedTaskIds(Array.from(new Set(ids)));
      })
      .catch(() => {
        if (active) {
          setSwipedTaskIds([]);
        }
      });

    return () => {
      active = false;
    };
  }, [profile.id]);

  useEffect(() => {
    const database = firebaseDb;

    if (!hasFirebaseConfig || !database || authBypassActive || !profile.google_authenticated) {
      return;
    }

    const unsubscribeProfiles = onSnapshot(collection(database, 'public_profiles'), (snapshot) => {
      const publicProfiles = snapshot.docs
        .map((item) => mapFirebaseProfile(item.id, item.data() as Record<string, unknown>))
        .filter((item) => item.id !== profile.id && item.username.trim());

      setProfiles((current) => {
        const currentProfile = current.find((item) => item.id === profile.id) ?? profile;
        return [currentProfile, ...publicProfiles];
      });
    });

    const unsubscribeTasks = onSnapshot(collection(database, 'tasks'), (snapshot) => {
      const liveTasks = snapshot.docs
        .map((item) => mapFirebaseTask({ id: item.id, ...item.data() }))
        .filter((task) => task.poster_id && task.title.trim());

      setTasks(liveTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });

    const unsubscribeMatches = onSnapshot(
      query(collection(database, 'matches'), where('participant_ids', 'array-contains', profile.id)),
      (snapshot) => {
        const incoming = snapshot.docs.map((item) => mapFirebaseMatch({ id: item.id, ...item.data() }));
        setMatches(mergeMatches([], incoming));
      },
    );

    const unsubscribeMessages = onSnapshot(
      query(collection(database, 'messages'), where('participant_ids', 'array-contains', profile.id)),
      (snapshot) => {
        const incoming = snapshot.docs.map((item) => mapFirebaseMessage({ id: item.id, ...item.data() }));
        setMessages(mergeMessages([], incoming));
      },
    );

    return () => {
      unsubscribeProfiles();
      unsubscribeTasks();
      unsubscribeMatches();
      unsubscribeMessages();
    };
  }, [
    mapFirebaseMatch,
    mapFirebaseMessage,
    mapFirebaseProfile,
    mapFirebaseTask,
    mergeMatches,
    mergeMessages,
    authBypassActive,
    profile,
  ]);

  useEffect(() => {
    const database = firebaseDb;

    if (!authBypassActive || !hasFirebaseConfig || !database) {
      return;
    }

    const unsubscribeTasks = onSnapshot(collection(database, 'tasks'), (snapshot) => {
      const liveTasks = snapshot.docs
        .map((item) => mapFirebaseTask({ id: item.id, ...item.data() }))
        .filter((task) => task.poster_id && task.title.trim());

      setTasks(liveTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });

    return () => {
      unsubscribeTasks();
    };
  }, [authBypassActive, mapFirebaseTask]);

  useEffect(() => {
    if (!authBypassActive) {
      return;
    }

    const currentProfile = profileRef.current;
    setProfiles(mergeProfilesById([currentProfile, ...authBypassProfiles]));
  }, [authBypassActive, authBypassProfiles]);

  const excludedDeckTaskIds = useMemo(() => {
    const ids = new Set(swipedTaskIds);

    matches.forEach((match) => {
      if (match.doer_id === profile.id) {
        ids.add(match.task_id);
      }
    });

    return ids;
  }, [matches, profile.id, swipedTaskIds]);
  const deck = useMemo(
    () => rankDeckTasks(tasks, profile, excludedDeckTaskIds, matches, profiles),
    [excludedDeckTaskIds, matches, profile, profiles, tasks],
  );
  const enrichedMatches = useMemo(() => enrichMatches(matches, tasks, profiles), [matches, profiles, tasks]);
  const isAccountReady = useMemo(() => authBypassActive || isProfileAppReady(profile), [authBypassActive, profile]);

  async function withTaskAiProfile(task: Task, existingTask?: Task): Promise<Task> {
    const signature = createTaskAiProfileSignature(task);

    if (
      existingTask?.ai_match_profile &&
      existingTask.ai_match_profile_signature === signature &&
      existingTask.ai_match_profile_updated_at
    ) {
      return {
        ...task,
        ai_match_profile: existingTask.ai_match_profile,
        ai_match_profile_signature: existingTask.ai_match_profile_signature,
        ai_match_profile_updated_at: existingTask.ai_match_profile_updated_at,
      };
    }

    const aiMatchProfile = await buildTaskAiMatchProfile(task);

    return {
      ...task,
      ai_match_profile: aiMatchProfile,
      ai_match_profile_signature: signature,
      ai_match_profile_updated_at: aiMatchProfile.generated_at,
    };
  }

  async function withProfileAiProfile(nextProfile: Profile, previousProfile = profile): Promise<Profile> {
    if (!shouldRefreshProfileAiProfile(previousProfile, nextProfile)) {
      return nextProfile;
    }

    const aiMatchProfile = await buildUserAiMatchProfile(nextProfile);

    return {
      ...nextProfile,
      ai_match_profile: aiMatchProfile,
      ai_match_profile_signature: createProfileAiProfileSignature(nextProfile),
      ai_match_profile_location: nextProfile.location,
      ai_match_profile_updated_at: aiMatchProfile.generated_at,
    };
  }

  function clearProfileAiRefreshTimeout() {
    if (profileAiRefreshTimeoutRef.current) {
      clearTimeout(profileAiRefreshTimeoutRef.current);
      profileAiRefreshTimeoutRef.current = null;
    }
  }

  function scheduleProfileAiRefresh(delayMs = PROFILE_AI_REFRESH_DEBOUNCE_MS) {
    if (authBypassActive) {
      return;
    }

    clearProfileAiRefreshTimeout();
    const runId = profileAiRefreshRunIdRef.current + 1;
    profileAiRefreshRunIdRef.current = runId;

    profileAiRefreshTimeoutRef.current = setTimeout(() => {
      profileAiRefreshTimeoutRef.current = null;
      const profileAtStart = profileRef.current;
      const expectedSignature = createProfileAiProfileSignature(profileAtStart);

      void withProfileAiProfile(profileAtStart, profileAtStart).then((profileWithAi) => {
        if (profileAiRefreshRunIdRef.current !== runId) {
          return;
        }

        const currentProfile = profileRef.current;

        if (createProfileAiProfileSignature(currentProfile) !== expectedSignature) {
          return;
        }

        const nextProfile = {
          ...currentProfile,
          ai_match_profile: profileWithAi.ai_match_profile,
          ai_match_profile_signature: profileWithAi.ai_match_profile_signature,
          ai_match_profile_location: profileWithAi.ai_match_profile_location,
          ai_match_profile_updated_at: profileWithAi.ai_match_profile_updated_at,
        };

        syncProfile(nextProfile);
        void persistProfile(nextProfile);
      });
    }, delayMs);
  }

  function blockedTaskResult(task: Task): TaskSaveResult | null {
    const safety = getTaskSafety(task);

    if (safety.status !== 'blocked') {
      return null;
    }

    return {
      ok: false,
      reason: 'unsafe_content',
      message: 'Profanity, NSFW, adult-service, illegal, or unsafe gigs cannot be posted on SideHustle. Edit the gig details before posting.',
    };
  }

  async function createTask(input: CreateTaskInput): Promise<TaskSaveResult> {
    if (input.boost_cost_bsts > profile.credits) {
      return {
        ok: false,
        reason: 'insufficient_credits',
        message: `You don't have enough BSTs for this boost.`,
      } satisfies TaskSaveResult;
    }

    const task = await withTaskAiProfile({
      id: createUuid(),
      poster_id: profile.id,
      title: input.title,
      description: input.description,
      budget: input.budget,
      category: input.category,
      location_label: input.location_label,
      location: profile.location,
      required_skills: input.requiredSkills.length > 0 ? input.requiredSkills : [input.category],
      image_urls: input.image_urls,
      is_boosted: input.is_boosted,
      boost_days: input.boost_days,
      boost_cost_bsts: input.boost_cost_bsts,
      date_window: input.date_window,
      status: 'open',
      created_at: new Date().toISOString(),
      ai_match_profile: null,
      ai_match_profile_signature: null,
      ai_match_profile_updated_at: null,
    });
    const blockedResult = blockedTaskResult(task);

    if (blockedResult) {
      return blockedResult;
    }

    setTasks((current) => [task, ...current]);

    if (input.boost_cost_bsts > 0) {
      const nextProfile = { ...profile, credits: profile.credits - input.boost_cost_bsts };
      syncProfile(nextProfile);
    }

    if (!authBypassActive && firebaseDb) {
      await setDoc(doc(firebaseDb, 'tasks', task.id), {
        ...task,
        image_urls: toShareableImageRefs(task.image_urls),
        updated_at: new Date().toISOString(),
      });

      if (input.boost_cost_bsts > 0) {
        await persistProfile({ ...profile, credits: profile.credits - input.boost_cost_bsts });
      }
    }

    return { ok: true };
  }

  async function updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskSaveResult> {
    const existingTask = tasks.find((item) => item.id === taskId);

    if (!existingTask || existingTask.poster_id !== profile.id) {
      return { ok: false, message: 'Only the gig creator can update this gig.' };
    }

    const boostDelta = Math.max(0, input.boost_cost_bsts - existingTask.boost_cost_bsts);

    if (boostDelta > profile.credits) {
      return {
        ok: false,
        reason: 'insufficient_credits',
        message: `You don't have enough BSTs for this boost.`,
      };
    }

    const nextTask = await withTaskAiProfile({
      ...existingTask,
      title: input.title,
      description: input.description,
      budget: input.budget,
      category: input.category,
      location_label: input.location_label,
      required_skills: input.requiredSkills.length > 0 ? input.requiredSkills : [input.category],
      image_urls: input.image_urls,
      is_boosted: input.is_boosted,
      boost_days: input.is_boosted ? input.boost_days : 0,
      boost_cost_bsts: input.is_boosted ? input.boost_cost_bsts : 0,
      date_window: input.date_window,
      status: input.status,
    }, existingTask);
    const blockedResult = blockedTaskResult(nextTask);

    if (blockedResult) {
      return blockedResult;
    }

    setTasks((current) => current.map((item) => (item.id === taskId ? nextTask : item)));

    if (boostDelta > 0) {
      syncProfile({ ...profile, credits: profile.credits - boostDelta });
    }

    if (!authBypassActive && firebaseDb) {
      await setDoc(
        doc(firebaseDb, 'tasks', taskId),
        {
          ...nextTask,
          image_urls: toShareableImageRefs(nextTask.image_urls),
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );

      if (boostDelta > 0) {
        await persistProfile({ ...profile, credits: profile.credits - boostDelta });
      }
    }

    return { ok: true };
  }

  async function deleteTask(taskId: string): Promise<StoreActionResult> {
    const existingTask = tasks.find((item) => item.id === taskId);

    if (!existingTask || existingTask.poster_id !== profile.id) {
      return { ok: false, message: 'Only the gig creator can delete this gig.' };
    }

    const taskMatches = matches.filter((match) => match.task_id === taskId);

    if (taskMatches.some((match) => match.status === 'completed')) {
      return { ok: false, message: 'Completed gigs stay in Archived and cannot be deleted.' };
    }

    if (!authBypassActive && firebaseDb) {
      try {
        await deleteDoc(doc(firebaseDb, 'tasks', taskId));
      } catch {
        return { ok: false, message: 'Could not delete this gig. Please try again.' };
      }
    }

    const taskMatchIds = new Set(taskMatches.map((match) => match.id));

    setTasks((current) => current.filter((item) => item.id !== taskId));
    setMatches((current) => current.filter((match) => match.task_id !== taskId));
    setMessages((current) => current.filter((message) => !taskMatchIds.has(message.match_id)));

    return { ok: true };
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
      doer_rating_by_poster: null,
      poster_rating_by_doer: null,
      poster_seen_counter_at: null,
      doer_seen_match_at: null,
      poster_read_messages_at: null,
      doer_read_messages_at: null,
      doer_completed_at: null,
      poster_completed_at: null,
      created_at: new Date().toISOString(),
    };

    setMatches((current) => [match, ...current]);

    if (!authBypassActive && firebaseDb) {
      await setDoc(doc(firebaseDb, 'matches', match.id), buildMatchRecord(match, task));
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
      doer_rating_by_poster: null,
      poster_rating_by_doer: null,
      poster_seen_counter_at: null,
      doer_seen_match_at: null,
      poster_read_messages_at: null,
      doer_read_messages_at: null,
      doer_completed_at: null,
      poster_completed_at: null,
      created_at: new Date().toISOString(),
    };

    setMatches((current) => [match, ...current]);

    if (!authBypassActive && firebaseDb) {
      await setDoc(doc(firebaseDb, 'matches', match.id), buildMatchRecord(match, task));
    }

    return match;
  }

  async function likeBack(matchId: string) {
    const acceptedAt = new Date().toISOString();

    setMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? { ...match, status: 'matched', doer_seen_match_at: null, poster_seen_counter_at: match.poster_seen_counter_at ?? acceptedAt }
          : match,
      ),
    );

    if (!authBypassActive && firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        status: 'matched',
        doer_seen_match_at: null,
        poster_seen_counter_at: acceptedAt,
        updated_at: acceptedAt,
      });
    }
  }

  async function unlockChat(matchId: string) {
    if (profile.credits < CHAT_UNLOCK_COST_BSTS) {
      return false;
    }

    syncProfile({ ...profile, credits: profile.credits - CHAT_UNLOCK_COST_BSTS });
    setMatches((current) =>
      current.map((matchItem) => (matchItem.id === matchId ? { ...matchItem, is_unlocked: true } : matchItem)),
    );

    if (!authBypassActive && firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        is_unlocked: true,
        updated_at: new Date().toISOString(),
      });
      await persistProfile({ ...profile, credits: profile.credits - CHAT_UNLOCK_COST_BSTS });
    }

    return true;
  }

  async function unlockAllBidders() {
    if (profile.bidder_access_unlocked_at) {
      return true;
    }

    if (profile.credits < SEE_MORE_BIDDERS_COST_BSTS) {
      return false;
    }

    const unlockedAt = new Date().toISOString();
    const nextProfile = {
      ...profile,
      credits: profile.credits - SEE_MORE_BIDDERS_COST_BSTS,
      bidder_access_unlocked_at: unlockedAt,
    };

    syncProfile(nextProfile);

    if (!authBypassActive && firebaseDb) {
      await persistProfile(nextProfile);
    }

    return true;
  }

  async function requestMatchCompletion(matchId: string) {
    const match = matches.find((item) => item.id === matchId);

    if (!match || match.doer_id !== profile.id || match.status !== 'matched' || match.doer_completed_at) {
      return;
    }

    const completedAt = new Date().toISOString();

    setMatches((current) =>
      current.map((item) => (item.id === matchId ? { ...item, doer_completed_at: completedAt } : item)),
    );

    if (!authBypassActive && firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        doer_completed_at: completedAt,
        updated_at: completedAt,
      });
    }
  }

  async function completeMatch(matchId: string) {
    const match = matches.find((item) => item.id === matchId);
    const task = match ? tasks.find((item) => item.id === match.task_id) : undefined;

    if (!match || !task || task.poster_id !== profile.id || match.status !== 'matched') {
      return;
    }

    const completedAt = new Date().toISOString();

    setMatches((current) =>
      current.map((item) =>
        item.id === matchId
          ? {
              ...item,
              status: 'completed',
              doer_completed_at: item.doer_completed_at ?? completedAt,
              poster_completed_at: completedAt,
            }
          : item,
      ),
    );

    if (task) {
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, status: 'archived' } : item)),
      );
    }

    setProfiles((current) =>
      current.map((item) => {
        if (item.id === match.doer_id) {
          return { ...item, vouch_count: item.vouch_count + 1 };
        }

        if (item.id === task.poster_id) {
          return { ...item, posted_vouch_count: item.posted_vouch_count + 1 };
        }

        return item;
      }),
    );
    setProfile((current) => {
      if (current.id === match.doer_id) {
        return { ...current, vouch_count: current.vouch_count + 1 };
      }

      if (current.id === task.poster_id) {
        return { ...current, posted_vouch_count: current.posted_vouch_count + 1 };
      }

      return current;
    });

    if (!authBypassActive && firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        status: 'completed',
        doer_completed_at: match.doer_completed_at ?? completedAt,
        poster_completed_at: completedAt,
        updated_at: completedAt,
      });

      await updateDoc(doc(firebaseDb, 'tasks', task.id), {
        status: 'archived',
        updated_at: completedAt,
      });
      await setDoc(
        doc(firebaseDb, 'profiles', task.poster_id),
        { posted_vouch_count: increment(1) },
        { merge: true },
      );
      await setDoc(
        doc(firebaseDb, 'public_profiles', task.poster_id),
        { posted_vouch_count: increment(1), updated_at: completedAt },
        { merge: true },
      );

      await setDoc(doc(firebaseDb, 'profiles', match.doer_id), { vouch_count: increment(1) }, { merge: true });
      await setDoc(
        doc(firebaseDb, 'public_profiles', match.doer_id),
        { vouch_count: increment(1), updated_at: completedAt },
        { merge: true },
      );
    }
  }

  async function rateMatch(matchId: string, value: number) {
    const match = matches.find((item) => item.id === matchId);
    const task = match ? tasks.find((item) => item.id === match.task_id) : undefined;
    const rating = normalizeRating(value);

    if (!match || !task || match.status !== 'completed') {
      return false;
    }

    const isPoster = task.poster_id === profile.id;
    const isDoer = match.doer_id === profile.id;

    if (!isPoster && !isDoer) {
      return false;
    }

    const ratingField = isPoster ? 'doer_rating_by_poster' : 'poster_rating_by_doer';
    const targetProfileId = isPoster ? match.doer_id : task.poster_id;
    const previousRating = match[ratingField];

    setMatches((current) =>
      current.map((item) => (item.id === matchId ? { ...item, [ratingField]: rating } : item)),
    );
    setProfiles((current) =>
      current.map((item) => (item.id === targetProfileId ? applyReceivedRating(item, rating, previousRating) : item)),
    );
    setProfile((current) =>
      current.id === targetProfileId ? applyReceivedRating(current, rating, previousRating) : current,
    );

    if (!authBypassActive && firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        [ratingField]: rating,
        updated_at: new Date().toISOString(),
      });

      const targetProfile = profiles.find((item) => item.id === targetProfileId);

      if (targetProfile) {
        const nextProfile = applyReceivedRating(targetProfile, rating, previousRating);
        const ratingRecord = {
          rating: nextProfile.rating,
          rating_count: nextProfile.rating_count,
          updated_at: new Date().toISOString(),
        };

        await Promise.allSettled([
          setDoc(doc(firebaseDb, 'profiles', targetProfileId), ratingRecord, { merge: true }),
          setDoc(doc(firebaseDb, 'public_profiles', targetProfileId), ratingRecord, { merge: true }),
        ]);
      }
    }

    return true;
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

    if (!authBypassActive && firebaseDb) {
      const match = matches.find((item) => item.id === matchId);
      const task = match ? tasks.find((item) => item.id === match.task_id) : undefined;
      await setDoc(doc(firebaseDb, 'messages', message.id), buildMessageRecord(message, match, task));
    }
  }

  async function markCounterBidsSeen(matchIds: string[]) {
    const ids = Array.from(new Set(matchIds.filter(Boolean)));

    if (ids.length === 0) {
      return;
    }

    const seenAt = new Date().toISOString();

    setMatches((current) =>
      current.map((match) =>
        ids.includes(match.id) && !match.poster_seen_counter_at
          ? { ...match, poster_seen_counter_at: seenAt }
          : match,
      ),
    );

    const database = authBypassActive ? null : firebaseDb;

    if (database) {
      await Promise.allSettled(
        ids.map((matchId) =>
          updateDoc(doc(database, 'matches', matchId), {
            poster_seen_counter_at: seenAt,
            updated_at: seenAt,
          }),
        ),
      );
    }
  }

  async function markAcceptedOffersSeen(matchIds: string[]) {
    const ids = Array.from(new Set(matchIds.filter(Boolean)));

    if (ids.length === 0) {
      return;
    }

    const seenAt = new Date().toISOString();

    setMatches((current) =>
      current.map((match) =>
        ids.includes(match.id) && !match.doer_seen_match_at ? { ...match, doer_seen_match_at: seenAt } : match,
      ),
    );

    const database = authBypassActive ? null : firebaseDb;

    if (database) {
      await Promise.allSettled(
        ids.map((matchId) =>
          updateDoc(doc(database, 'matches', matchId), {
            doer_seen_match_at: seenAt,
            updated_at: seenAt,
          }),
        ),
      );
    }
  }

  async function markMessagesRead(matchId: string) {
    const match = matches.find((item) => item.id === matchId);
    const task = match ? tasks.find((item) => item.id === match.task_id) : undefined;
    const field =
      task?.poster_id === profile.id
        ? 'poster_read_messages_at'
        : match?.doer_id === profile.id
          ? 'doer_read_messages_at'
          : null;

    if (!match || !field) {
      return;
    }

    const readAt = new Date().toISOString();

    setMatches((current) =>
      current.map((item) => (item.id === matchId ? { ...item, [field]: readAt } : item)),
    );

    if (!authBypassActive && firebaseDb) {
      await updateDoc(doc(firebaseDb, 'matches', matchId), {
        [field]: readAt,
        updated_at: readAt,
      });
    }
  }

  async function verifySelfie(avatarUri: string) {
    const nextProfile = {
      ...profile,
      avatar_url: avatarUri,
      is_verified: true,
    };

    syncProfile(nextProfile);

    if (!authBypassActive && firebaseDb) {
      await persistProfile(nextProfile);
    }
  }

  async function signInWithGoogle(): Promise<StoreActionResult> {
    setAuthLoading(true);

    try {
      setAuthBypassActive(false);
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

  async function signInWithAuthBypass(profileId: string): Promise<StoreActionResult> {
    const selectedProfile = authBypassProfiles.find((item) => item.id === profileId);

    if (!selectedProfile) {
      return { ok: false, message: 'That demo account is not available right now.' };
    }

    setAuthLoading(true);

    try {
      clearProfileAiRefreshTimeout();
      profileAiRefreshRunIdRef.current += 1;

      const nextProfile = asBypassReadyProfile(selectedProfile);

      if (firebaseAuth?.currentUser) {
        await firebaseAuth.signOut().catch(() => undefined);
      }

      setAuthBypassActive(true);
      setAuthUserEmail(null);
      setAuthUserName(nextProfile.username);
      setMatches([]);
      setMessages([]);
      setSwipedTaskIds([]);
      syncProfile(nextProfile);
      setProfiles(mergeProfilesById([nextProfile, ...authBypassProfiles]));

      return { ok: true };
    } finally {
      setAuthLoading(false);
    }
  }

  function startPhoneOnlyAuth(): StoreActionResult {
    return { ok: false, message: 'Create or log in with Google before verifying your phone.' };
  }

  async function requestPhoneVerification(phoneNumber: string): Promise<PhoneActionResult> {
    if (!firebaseAuth?.currentUser || !profile.google_authenticated) {
      return { ok: false, message: 'Sign in with Google before verifying your phone.' };
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      return { ok: false, message: 'Enter a valid phone number, including area code.' };
    }

    return requestFirebasePhoneVerification(normalizedPhone, 'demo-phone-verifier');
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

    if (!authBypassActive && firebaseDb) {
      try {
        await persistProfile(nextProfile);
      } catch {
        // Phone linking should still finish locally if Firestore is temporarily unavailable.
      }
    }

    return { ok: true, phone: verifiedPhone };
  }

  async function completeOnboarding(input: OnboardingInput) {
    if (!profile.google_authenticated || !profile.phone_verified) {
      throw new Error('Google sign-in and phone verification are required before onboarding can finish.');
    }

    if (
      !input.username.trim() ||
      !input.phoneNumber.trim() ||
      !input.birthDate ||
      !input.bio.trim() ||
      !input.educationLevel ||
      input.interests.length < 5
    ) {
      throw new Error('Account details are incomplete.');
    }

    const shouldAwardSignup = !profile.signup_bonus_awarded;
    const now = new Date().toISOString();
    const nextProfile: Profile = await withProfileAiProfile({
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
      is_verified: profile.is_verified || input.selfieVerified,
      is_onboarded: true,
      accepted_terms_at: now,
      signup_bonus_awarded: true,
      credits: profile.credits + (shouldAwardSignup ? SIGNUP_BONUS_BSTS : 0),
    });

    syncProfile(nextProfile);

    if (!authBypassActive && firebaseDb) {
      await persistProfile(nextProfile);
    }
  }

  async function updateProfileDetails(input: ProfileUpdateInput) {
    const baseProfile = {
      ...profile,
      ...input,
      avatar_url: input.avatar_url ?? profile.avatar_url,
      skills: input.skills ?? input.interests ?? profile.skills,
    };
    const nextProfile = await withProfileAiProfile(baseProfile);

    syncProfile(nextProfile);

    if (!authBypassActive && firebaseDb) {
      await persistProfile(nextProfile);
    }
  }

  function buyBsts(amount: number) {
    const nextProfile = { ...profile, credits: profile.credits + amount };
    syncProfile(nextProfile);
    void persistProfile(nextProfile);
  }

  function updateRadius(radius: number) {
    const nextRadius = Math.min(100, Math.max(1, Math.round(radius)));
    const nextProfile = { ...profile, search_radius: nextRadius };
    syncProfile(nextProfile);
    void persistProfile(nextProfile);
  }

  function updateInterests(interests: string[]) {
    const nextProfile = { ...profile, interests, skills: interests };
    syncProfile(nextProfile);
    void persistProfile(nextProfile);
    scheduleProfileAiRefresh();
  }

  function rememberSwipedTask(taskId: string) {
    if (!taskId) {
      return;
    }

    setSwipedTaskIds((current) => {
      if (current.includes(taskId)) {
        return current;
      }

      const nextTaskIds = [...current, taskId];
      void AsyncStorage.setItem(swipeContextStorageKey(profile.id), JSON.stringify(nextTaskIds));
      return nextTaskIds;
    });
  }

  function clearSwipeContext() {
    setSwipedTaskIds([]);
    void AsyncStorage.removeItem(swipeContextStorageKey(profile.id));
  }

  function updateLocation(coords: Coordinates) {
    const nextProfile = { ...profile, location: coords };
    syncProfile(nextProfile);
    void persistProfile(nextProfile);
    scheduleProfileAiRefresh();
  }

  function toggleColorMode() {
    setColorMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  function logout() {
    clearProfileAiRefreshTimeout();
    profileAiRefreshRunIdRef.current += 1;
    setAuthBypassActive(false);

    if (firebaseAuth) {
      void firebaseAuth.signOut();
    }

    setAuthUserEmail(null);
    setAuthUserName(null);
    setProfiles([defaultProfile]);
    setTasks([]);
    setMatches([]);
    setMessages([]);
    setSwipedTaskIds([]);
    syncProfile({
      ...defaultProfile,
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
    isLiveMode: hasFirebaseConfig && !authBypassActive,
    authBypassActive,
    authBypassProfiles,
    isAccountReady,
    authLoading,
    authUserEmail,
    authUserName,
    isDark,
    colorMode,
    swipedTaskCount: swipedTaskIds.length,
    createTask,
    updateTask,
    deleteTask,
    submitBid,
    submitMatchedBid,
    likeBack,
    unlockChat,
    unlockAllBidders,
    requestMatchCompletion,
    completeMatch,
    rateMatch,
    sendMessage,
    markCounterBidsSeen,
    markAcceptedOffersSeen,
    markMessagesRead,
    verifySelfie,
    startPhoneOnlyAuth,
    signInWithGoogle,
    signInWithAuthBypass,
    requestPhoneVerification,
    confirmPhoneVerification,
    completeOnboarding,
    updateProfileDetails,
    buyBsts,
    updateRadius,
    updateInterests,
    updateLocation,
    toggleColorMode,
    logout,
    rememberSwipedTask,
    clearSwipeContext,
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
