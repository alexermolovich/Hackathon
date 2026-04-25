export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  skills: string[];
  credits: number;
  location: Coordinates;
  search_radius: number;
  is_verified: boolean;
  vouch_count: number;
  rating: number;
};

export type Task = {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  location: Coordinates;
  required_skills: string[];
  is_boosted: boolean;
  created_at: string;
};

export type MatchStatus = 'pending' | 'matched' | 'completed';

export type GigMatch = {
  id: string;
  task_id: string;
  doer_id: string;
  bid_note: string;
  is_unlocked: boolean;
  status: MatchStatus;
  created_at: string;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type EnrichedMatch = GigMatch & {
  task: Task;
  doer: Profile;
  poster: Profile;
};
