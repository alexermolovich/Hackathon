import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

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
  required_skills: string[];
  is_boosted: boolean;
};

type GigStoreValue = {
  profile: Profile;
  profiles: Profile[];
  tasks: Task[];
  deck: Task[];
  matches: EnrichedMatch[];
  messages: Message[];
  isLiveMode: boolean;
  celebratedMatchId: string | null;
  createTask: (input: CreateTaskInput) => Promise<void>;
  submitBid: (task: Task, bidNote: string) => Promise<GigMatch>;
  likeBack: (matchId: string) => Promise<void>;
  unlockChat: (matchId: string) => Promise<boolean>;
  completeMatch: (matchId: string) => Promise<void>;
  sendMessage: (matchId: string, content: string) => Promise<void>;
  verifySelfie: (avatarUri: string) => Promise<void>;
  updateRadius: (radius: number) => void;
  updateLocation: (coords: Coordinates) => void;
  clearCelebration: () => void;
};

const GigStoreContext = createContext<GigStoreValue | null>(null);

export function GigProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<Profile>(seededCurrentUser);
  const [profiles, setProfiles] = useState<Profile[]>(seededProfiles);
  const [tasks, setTasks] = useState<Task[]>(seededTasks);
  const [matches, setMatches] = useState<GigMatch[]>(seededMatches);
  const [messages, setMessages] = useState<Message[]>(seededMessages);
  const [celebratedMatchId, setCelebratedMatchId] = useState<string | null>(null);

  const requestCurrentLocation = useCallback(async () => {
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
      // The seeded Denver coordinate keeps the demo useful if location is unavailable.
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
    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, []);

  const mapSupabaseTask = useCallback(
    (row: Record<string, unknown>): Task => ({
      id: String(row.id),
      poster_id: String(row.poster_id),
      title: String(row.title),
      description: String(row.description),
      budget: Number(row.budget),
      category: String(row.category),
      location: {
        latitude: Number(row.latitude ?? profile.location.latitude),
        longitude: Number(row.longitude ?? profile.location.longitude),
      },
      required_skills: Array.isArray(row.required_skills) ? (row.required_skills as string[]) : [],
      is_boosted: Boolean(row.is_boosted),
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
          user_skills: nextProfile.skills,
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
      .channel('gigswipe-match-chat')
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
    const task: Task = {
      id: createUuid(),
      poster_id: profile.id,
      title: input.title,
      description: input.description,
      budget: input.budget,
      category: input.category,
      location: profile.location,
      required_skills: input.required_skills,
      is_boosted: input.is_boosted,
      created_at: new Date().toISOString(),
    };

    setTasks((current) => [task, ...current]);

    if (supabase) {
      await supabase.from('tasks').insert({
        id: task.id,
        poster_id: task.poster_id,
        title: task.title,
        description: task.description,
        budget: task.budget,
        category: task.category,
        location: `SRID=4326;POINT(${task.location.longitude} ${task.location.latitude})`,
        required_skills: task.required_skills,
        is_boosted: task.is_boosted,
      });
    }
  }

  async function submitBid(task: Task, bidNote: string) {
    const match: GigMatch = {
      id: createUuid(),
      task_id: task.id,
      doer_id: profile.id,
      bid_note: bidNote.trim(),
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
        is_unlocked: false,
        status: 'pending',
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
    if (profile.credits < 5) {
      return false;
    }

    if (supabase) {
      const { error } = await supabase.rpc('unlock_match_chat', {
        match_uuid: matchId,
        doer_uuid: profile.id,
      });

      if (error) {
        return false;
      }
    }

    setProfile((current) => ({ ...current, credits: current.credits - 5 }));
    setProfiles((current) =>
      current.map((item) => (item.id === profile.id ? { ...item, credits: item.credits - 5 } : item)),
    );
    setMatches((current) =>
      current.map((match) => (match.id === matchId ? { ...match, is_unlocked: true } : match)),
    );

    return true;
  }

  async function completeMatch(matchId: string) {
    const match = matches.find((item) => item.id === matchId);

    setMatches((current) =>
      current.map((item) => (item.id === matchId ? { ...item, status: 'completed' } : item)),
    );

    if (match) {
      setProfiles((current) =>
        current.map((item) =>
          item.id === match.doer_id ? { ...item, vouch_count: item.vouch_count + 1 } : item,
        ),
      );
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

    setProfile(nextProfile);
    setProfiles((current) => current.map((item) => (item.id === profile.id ? nextProfile : item)));

    if (supabase) {
      await supabase.from('profiles').update({ avatar_url: avatarUri, is_verified: true }).eq('id', profile.id);
    }
  }

  function updateRadius(radius: number) {
    setProfile((current) => ({ ...current, search_radius: radius }));
    setProfiles((current) =>
      current.map((item) => (item.id === profile.id ? { ...item, search_radius: radius } : item)),
    );
  }

  function updateLocation(coords: Coordinates) {
    setProfile((current) => ({ ...current, location: coords }));
    setProfiles((current) =>
      current.map((item) => (item.id === profile.id ? { ...item, location: coords } : item)),
    );
  }

  const value: GigStoreValue = {
    profile,
    profiles,
    tasks,
    deck,
    matches: enrichedMatches,
    messages,
    isLiveMode: hasSupabaseConfig,
    celebratedMatchId,
    createTask,
    submitBid,
    likeBack,
    unlockChat,
    completeMatch,
    sendMessage,
    verifySelfie,
    updateRadius,
    updateLocation,
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
