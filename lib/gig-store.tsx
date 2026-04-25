import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { PropsWithChildren } from 'react';

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
import { hasSupabaseConfig, supabase } from './supabase';
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
  educationLevel: string | null;
  interests: string[];
  avatarUrl: string | null;
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

export function GigProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [profile, setProfile] = useState<Profile>(seededCurrentUser);
  const [profiles, setProfiles] = useState<Profile[]>(seededProfiles);
  const [tasks, setTasks] = useState<Task[]>(seededTasks);
  const [matches, setMatches] = useState<GigMatch[]>(seededMatches);
  const [messages, setMessages] = useState<Message[]>(seededMessages);
  const [celebratedMatchId, setCelebratedMatchId] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(systemScheme === 'light' ? 'light' : 'dark');
  const isDark = colorMode === 'dark';

  const syncProfile = useCallback(
    (nextProfile: Profile) => {
      setProfile(nextProfile);
      setProfiles((current) => current.map((item) => (item.id === nextProfile.id ? nextProfile : item)));
    },
    [],
  );

  const requestCurrentLocation = useCallback(async () => {
    if (!hasSupabaseConfig) {
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

  const mapSupabaseTask = useCallback(
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
      created_at: String(row.created_at),
    }),
    [profile.location.latitude, profile.location.longitude],
  );

  const mapSupabaseMatch = useCallback(
    (row: Record<string, unknown>): GigMatch => ({
      id: String(row.id),
      task_id: String(row.task_id),
      doer_id: String(row.doer_id),
      bid_note: String(row.bid_note ?? ''),
      counter_bid: Number(row.counter_bid ?? 0),
      availability_window: String(row.availability_window ?? ''),
      is_unlocked: Boolean(row.is_unlocked),
      status: (row.status as GigMatch['status']) ?? 'pending',
      created_at: String(row.created_at ?? new Date().toISOString()),
    }),
    [],
  );

  const mapSupabaseMessage = useCallback(
    (row: Record<string, unknown>): Message => ({
      id: String(row.id),
      match_id: String(row.match_id),
      sender_id: String(row.sender_id),
      content: String(row.content ?? ''),
      created_at: String(row.created_at ?? new Date().toISOString()),
    }),
    [],
  );

  const hydrateMessages = useCallback(async () => {
    if (!supabase) {
      return;
    }

    try {
      const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });

      if (Array.isArray(data)) {
        setMessages(data as Message[]);
      }
    } catch {
      // Keep current local messages on transient network errors.
    }
  }, []);

  const hydrateFromSupabase = useCallback(
    async (nextProfile: Profile) => {
      if (!supabase) {
        return;
      }

      try {
        const { data: deckRows } = await supabase.rpc('get_gig_deck', {
          user_lat: nextProfile.location.latitude,
          user_lng: nextProfile.location.longitude,
          radius_miles: nextProfile.search_radius,
          user_skills: nextProfile.interests,
        });

        if (Array.isArray(deckRows) && deckRows.length > 0) {
          const liveTasks = deckRows.map((row) => mapSupabaseTask(row as Record<string, unknown>));
          setTasks((existing) => mergeTasks(existing, liveTasks));
        }
      } catch {
        // Mock data remains the first-run fallback for hackathon demos.
      }

      await hydrateMessages();
    },
    [hydrateMessages, mapSupabaseTask, mergeTasks],
  );

  useEffect(() => {
    void requestCurrentLocation();
  }, [requestCurrentLocation]);

  useEffect(() => {
    const client = supabase;

    if (!hasSupabaseConfig || !client) {
      return;
    }

    const channel = client
      .channel('sidehustle-match-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        const row = payload.new as Record<string, unknown> | null;

        if (!row?.id) {
          return;
        }

        const nextMatch = mapSupabaseMatch(row);
        setMatches((current) => mergeMatches(current, [nextMatch]));

        if (nextMatch.status === 'matched' && nextMatch.doer_id === profile.id) {
          setCelebratedMatchId(nextMatch.id);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as Record<string, unknown> | null;

        if (row?.id) {
          setMessages((current) => mergeMessages(current, [mapSupabaseMessage(row)]));
        }
      })
      .subscribe();

    void hydrateFromSupabase(profile);

    return () => {
      void client.removeChannel(channel);
    };
  }, [hydrateFromSupabase, mapSupabaseMatch, mapSupabaseMessage, mergeMatches, mergeMessages, profile]);

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

    if (supabase) {
      await supabase.from('tasks').insert({
        id: task.id,
        poster_id: task.poster_id,
        title: task.title,
        description: task.description,
        budget: task.budget,
        category: task.category,
        location_label: task.location_label,
        location: `SRID=4326;POINT(${task.location.longitude} ${task.location.latitude})`,
        required_skills: task.required_skills,
        image_urls: task.image_urls,
        is_boosted: task.is_boosted,
        boost_days: task.boost_days,
        boost_cost_bsts: task.boost_cost_bsts,
        date_window: task.date_window,
        status: task.status,
      });
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

    if (supabase) {
      await supabase.from('matches').insert({
        id: match.id,
        task_id: task.id,
        doer_id: profile.id,
        bid_note: match.bid_note,
        counter_bid: match.counter_bid,
        availability_window: match.availability_window,
        is_unlocked: false,
        status: 'pending',
      });
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

    if (supabase) {
      await supabase.from('matches').insert({
        id: match.id,
        task_id: task.id,
        doer_id: profile.id,
        bid_note: match.bid_note,
        counter_bid: match.counter_bid,
        availability_window: match.availability_window,
        is_unlocked: false,
        status: 'matched',
      });
    }

    return match;
  }

  async function likeBack(matchId: string) {
    setMatches((current) =>
      current.map((match) => (match.id === matchId ? { ...match, status: 'matched' } : match)),
    );
    setCelebratedMatchId(matchId);

    if (supabase) {
      await supabase.from('matches').update({ status: 'matched' }).eq('id', matchId);
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

    if (supabase) {
      const { error } = await supabase.rpc('unlock_match_chat', {
        match_uuid: matchId,
        doer_uuid: profile.id,
      });

      if (error) {
        return false;
      }
    }

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

    if (supabase) {
      await supabase.rpc('complete_match_and_vouch', { match_uuid: matchId });
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

    if (supabase) {
      await supabase.from('messages').insert({
        id: message.id,
        match_id: matchId,
        sender_id: profile.id,
        content: trimmed,
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

    if (supabase) {
      await supabase.from('profiles').update({ avatar_url: avatarUri, is_verified: true }).eq('id', profile.id);
    }
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
      is_verified: Boolean(input.avatarUrl),
      is_onboarded: true,
      accepted_terms_at: now,
      signup_bonus_awarded: true,
      credits: profile.credits + (shouldAwardSignup ? SIGNUP_BONUS_BSTS : 0),
    };

    syncProfile(nextProfile);

    if (supabase) {
      await supabase.from('profiles').upsert({
        id: nextProfile.id,
        username: nextProfile.username,
        avatar_url: nextProfile.avatar_url,
        bio: nextProfile.bio,
        skills: nextProfile.skills,
        interests: nextProfile.interests,
        credits: nextProfile.credits,
        search_radius: nextProfile.search_radius,
        is_verified: nextProfile.is_verified,
        phone_number: nextProfile.phone_number,
        birth_date: nextProfile.birth_date,
        education_level: nextProfile.education_level,
        accepted_terms_at: nextProfile.accepted_terms_at,
      });
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
    syncProfile({
      ...profile,
      is_onboarded: false,
      google_authenticated: false,
      accepted_terms_at: null,
      phone_number: '',
    });
  }

  const value: GigStoreValue = {
    profile,
    profiles,
    tasks,
    deck,
    matches: enrichedMatches,
    messages,
    isLiveMode: hasSupabaseConfig,
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
