export const APP_NAME = 'SideHustle';
export const GIG_NAME = 'Gig';
export const GIG_NAME_PLURAL = 'Gigs';
export const CURRENCY_NAME = 'BSTs';
export const CURRENCY_FULL_NAME = 'Blood & Sweat Tokens';

export const SIGNUP_BONUS_BSTS = 25;
export const CHAT_UNLOCK_COST_BSTS = 5;
export const BOOST_COST_PER_DAY_BSTS = 3;

export const DAILY_REWARD_BSTS = 2;
export const WEEKLY_STREAK_BONUS_BSTS = 10;
export const MONTHLY_STREAK_BONUS_BSTS = 50;

export const POPULAR_CATEGORIES = [
  'Moving',
  'Cleaning',
  'Errands',
  'Assembly',
  'Tech Setup',
  'Events',
  'Delivery',
  'Yard Work',
  'Pet Care',
  'Tutoring',
  'Handywork',
  'Organizing',
  'Photography',
  'Beauty',
  'Fitness',
  'Cooking',
  'Childcare',
  'Auto Help',
  'Admin',
  'Hospitality',
] as const;

export const EDUCATION_LEVELS = [
  'Prefer not to say',
  'High school',
  'Some college',
  'Associate degree',
  'Bachelor degree',
  'Graduate degree',
  'Trade certification',
] as const;

export const BST_PACKAGES = [
  { id: 'spark', label: 'Spark Pack', amount: 25, price: '$1.99' },
  { id: 'grind', label: 'Grind Pack', amount: 70, price: '$4.99' },
  { id: 'blaze', label: 'Blaze Pack', amount: 160, price: '$9.99' },
] as const;
