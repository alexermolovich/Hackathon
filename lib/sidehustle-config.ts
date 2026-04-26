export const APP_NAME = 'SideHustle';
export const GIG_NAME = 'Gig';
export const GIG_NAME_PLURAL = 'Gigs';
export const CURRENCY_NAME = 'BSTs';
export const CURRENCY_FULL_NAME = 'Blood & Sweat Tokens';

export const SIGNUP_BONUS_BSTS = 25;
export const CHAT_UNLOCK_COST_BSTS = 10;
export const SEE_MORE_BIDDERS_COST_BSTS = 30;

export const BOOST_OPTIONS = [
  { days: 1, cost: 50 },
  { days: 3, cost: 75 },
  { days: 7, cost: 100 },
] as const;

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
  { id: 'pocket', label: 'Pocket Change', amount: 200, price: '$1.99', value: 'Standard' },
  { id: 'grinder', label: 'The Grinder', amount: 550, price: '$4.99', value: '10% Bonus' },
  { id: 'pro', label: 'Pro Hustler', amount: 1200, price: '$9.99', value: '20% Bonus' },
] as const;
