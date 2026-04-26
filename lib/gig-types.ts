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
  interests: string[];
  credits: number;
  location: Coordinates;
  search_radius: number;
  is_verified: boolean;
  is_onboarded: boolean;
  google_authenticated: boolean;
  phone_number: string;
  phone_verified: boolean;
  birth_date: string;
  education_level: string | null;
  accepted_terms_at: string | null;
  signup_bonus_awarded: boolean;
  daily_streak: number;
  weekly_streak: number;
  monthly_streak: number;
  last_reward_claimed_at: string | null;
  bidder_access_unlocked_at: string | null;
  vouch_count: number;
  posted_vouch_count: number;
  rating: number;
  rating_count: number;
};

export type TaskStatus = 'open' | 'archived';

export type Task = {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  location_label: string;
  location: Coordinates;
  required_skills: string[];
  image_urls: string[];
  is_boosted: boolean;
  boost_days: number;
  boost_cost_bsts: number;
  date_window: string;
  status: TaskStatus;
  created_at: string;
};

export type MatchStatus = 'pending' | 'matched' | 'completed';

export type GigMatch = {
  id: string;
  task_id: string;
  doer_id: string;
  bid_note: string;
  counter_bid: number;
  availability_window: string;
  is_unlocked: boolean;
  status: MatchStatus;
  doer_rating_by_poster: number | null;
  poster_rating_by_doer: number | null;
  poster_seen_counter_at: string | null;
  doer_seen_match_at: string | null;
  poster_read_messages_at: string | null;
  doer_read_messages_at: string | null;
  doer_completed_at: string | null;
  poster_completed_at: string | null;
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
