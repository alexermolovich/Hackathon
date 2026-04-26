import type {
  AiMatchSafety,
  AiTaskMatchProfile,
  AiUserMatchProfile,
  Coordinates,
  GigMatch,
  Profile,
  Task,
} from './gig-types';
import { calculateAge, getTaskCategoryLabels, milesBetween, skillMatchCount } from './gig-utils';

const AI_MATCH_ENDPOINT = process.env.EXPO_PUBLIC_SIDEHUSTLE_AI_MATCH_ENDPOINT;
const AI_MATCH_TIMEOUT_MS = 6000;
const TASK_AI_MATCH_PROFILE_VERSION = 'gig-safety-v3';
const PROFILE_LOCATION_REFRESH_MILES = 100;
const TASK_SUMMARY_MAX_LENGTH = 180;
const PROFILE_SUMMARY_MAX_LENGTH = 160;

type TaskProfileInput = Pick<
  Task,
  'title' | 'description' | 'category' | 'required_skills' | 'location_label' | 'date_window' | 'budget'
>;

type UserProfileInput = Pick<
  Profile,
  'bio' | 'birth_date' | 'interests' | 'skills' | 'location' | 'rating' | 'rating_count' | 'vouch_count' | 'is_verified'
>;

type TaskAiResponse = Partial<Omit<AiTaskMatchProfile, 'generated_at' | 'source'>> & {
  nsfw?: boolean;
  profanity?: boolean;
};

type UserAiResponse = Partial<Omit<AiUserMatchProfile, 'generated_at' | 'source'>>;

type RankedTask = {
  score: number;
  task: Task;
};

const stopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'need',
  'needs',
  'of',
  'on',
  'or',
  'the',
  'this',
  'to',
  'with',
  'you',
]);

const conceptLexicon: Record<string, string[]> = {
  admin: ['admin', 'assistant', 'data', 'document', 'spreadsheet', 'schedule', 'typing', 'office', 'paperwork'],
  assembly: ['assembly', 'assemble', 'build', 'chair', 'desk', 'furniture', 'ikea', 'install', 'shelf'],
  auto: ['auto', 'car', 'vehicle', 'jump', 'battery', 'detail', 'wash', 'oil', 'tire'],
  beauty: ['beauty', 'hair', 'makeup', 'nails', 'salon', 'style', 'styling'],
  childcare: ['childcare', 'babysit', 'baby', 'kid', 'children', 'school', 'pickup'],
  cleaning: ['clean', 'cleaning', 'sweep', 'mop', 'vacuum', 'wipe', 'dust', 'laundry', 'reset'],
  cooking: ['cook', 'cooking', 'meal', 'catering', 'food', 'kitchen', 'prep'],
  delivery: ['delivery', 'deliver', 'pickup', 'dropoff', 'courier', 'drive', 'transport'],
  errands: ['errand', 'errands', 'grocery', 'pickup', 'return', 'shopping', 'post office'],
  events: ['event', 'events', 'booth', 'venue', 'party', 'setup', 'checkout', 'hospitality'],
  fitness: ['fitness', 'workout', 'training', 'trainer', 'gym', 'exercise'],
  handywork: ['handy', 'handyman', 'repair', 'fix', 'mount', 'tool', 'install', 'drill'],
  hospitality: ['hospitality', 'host', 'guest', 'lobby', 'service', 'venue', 'front desk'],
  moving: ['move', 'moving', 'lift', 'carry', 'haul', 'box', 'bins', 'furniture', 'load', 'unload'],
  organizing: ['organize', 'organizing', 'sort', 'label', 'declutter', 'storage', 'bins'],
  pet: ['pet', 'dog', 'cat', 'walk', 'walking', 'feed', 'sitting', 'animal'],
  photography: ['photo', 'photography', 'camera', 'shoot', 'studio', 'lighting', 'backdrop'],
  tech: ['tech', 'technology', 'smartphone', 'phone', 'iphone', 'android', 'wifi', 'wi-fi', 'router', 'computer', 'printer', 'cable', 'mesh', 'device'],
  tutoring: ['tutor', 'tutoring', 'lesson', 'homework', 'math', 'study', 'teach'],
  yard: ['yard', 'lawn', 'grass', 'mow', 'rake', 'garden', 'weed', 'snow', 'shovel'],
};

const blockedSafetyPatterns = [
  /\b\w*f+u+c+k+\w*\b/i,
  /\bs+h+i+t+\w*\b/i,
  /\bb+i+t+c+h+\w*\b/i,
  /\ba+s+s+h+o+l+e+\w*\b/i,
  /\bb+a+s+t+a+r+d+\w*\b/i,
  /\bd+i+c+k+\w*\b/i,
  /\bc+u+n+t+\w*\b/i,
  /\bp+i+s+s+\w*\b/i,
  /\bd+a+m+n+\w*\b/i,
  /\bnsfw\b/i,
  /\badult content\b/i,
  /\bescort\b/i,
  /\bescort services?\b/i,
  /\berotic\b/i,
  /\bfetish\b/i,
  /\bfoot fetish\b/i,
  /\bhappy ending\b/i,
  /\bintimate photos?\b/i,
  /\bintimate videos?\b/i,
  /\bmassage with extras?\b/i,
  /\bnaked\b/i,
  /\bsex\b/i,
  /\bsex\s*(wanted|needed|request|requests|service|services|work|job|meet|meeting)\b/i,
  /\b(want|wanted|need|needed|looking for|seeking)\s+\w*\s*sex\b/i,
  /\bsexy\b/i,
  /\bsexual\b/i,
  /\bsexual services?\b/i,
  /\bsex work\b/i,
  /\bhookups?\b/i,
  /\bhook\s*ups?\b/i,
  /\bfwb\b/i,
  /\bfriends with benefits\b/i,
  /\bsensual\b/i,
  /\badult fun\b/i,
  /\bnude\b/i,
  /\bnudes\b/i,
  /\bonlyfans\b/i,
  /\bxxx\b/i,
  /\bporn\b/i,
  /\bpornographic\b/i,
  /\bstripper\b/i,
  /\blap dance\b/i,
  /\bdrug\b/i,
  /\bdrugs\b/i,
  /\bcocaine\b/i,
  /\bmeth\b/i,
  /\bweed delivery\b/i,
  /\bweapon\b/i,
  /\bgun\b/i,
  /\bammo\b/i,
  /\bstolen\b/i,
  /\bfake id\b/i,
];

const reviewSafetyPatterns = [
  /\balcohol\b/i,
  /\btobacco\b/i,
  /\bvape\b/i,
  /\bhazardous\b/i,
  /\bchemical\b/i,
  /\bbiohazard\b/i,
  /\bmedical\b/i,
  /\blegal advice\b/i,
];

export function createTaskAiProfileSignature(task: TaskProfileInput) {
  return stableSignature([
    TASK_AI_MATCH_PROFILE_VERSION,
    task.title,
    task.description,
    task.category,
    task.required_skills,
    task.location_label,
    task.date_window,
    task.budget,
  ]);
}

export function createProfileAiProfileSignature(profile: UserProfileInput) {
  return stableSignature([
    profile.birth_date,
    profile.bio,
    profile.interests,
    profile.skills,
    profile.is_verified,
    profile.rating_count >= 5 ? Math.round(profile.rating * 10) / 10 : null,
    profile.vouch_count,
  ]);
}

export function shouldRefreshProfileAiProfile(previous: Profile, next: Profile) {
  const nextSignature = createProfileAiProfileSignature(next);

  if (!next.ai_match_profile || next.ai_match_profile_signature !== nextSignature) {
    return true;
  }

  if (!next.ai_match_profile_location) {
    return true;
  }

  const distanceFromProfileAnchor = milesBetween(next.ai_match_profile_location, next.location);
  const distanceFromPreviousLocation = milesBetween(previous.location, next.location);
  return Math.max(distanceFromProfileAnchor, distanceFromPreviousLocation) >= PROFILE_LOCATION_REFRESH_MILES;
}

export async function buildTaskAiMatchProfile(task: TaskProfileInput): Promise<AiTaskMatchProfile> {
  const fallback = () => buildLocalTaskMatchProfile(task);
  const remote = await requestAiMatchProfile<TaskProfileInput, TaskAiResponse>('task_match_profile', task);

  if (!remote) {
    return fallback();
  }

  return normalizeTaskMatchProfile(remote, fallback());
}

export async function buildUserAiMatchProfile(profile: UserProfileInput): Promise<AiUserMatchProfile> {
  const fallback = () => buildLocalUserMatchProfile(profile);
  const remote = await requestAiMatchProfile<UserProfileInput, UserAiResponse>('user_match_profile', {
    ...profile,
    age: calculateAge(profile.birth_date),
  } as UserProfileInput & { age: number | null });

  if (!remote) {
    return fallback();
  }

  return normalizeUserMatchProfile(remote, fallback());
}

export function rankDeckTasks(
  tasks: Task[],
  user: Profile,
  excludedTaskIds: ReadonlySet<string> = new Set(),
  matches: GigMatch[] = [],
  profiles: Profile[] = [],
) {
  const positiveConcepts = buildEngagementConcepts(tasks, matches, user.id);
  const postersById = new Map(profiles.map((profile) => [profile.id, profile]));
  const ranked = tasks
    .filter((task) => task.status === 'open')
    .filter((task) => !excludedTaskIds.has(task.id))
    .filter((task) => task.poster_id !== user.id)
    .filter((task) => milesBetween(user.location, task.location) <= user.search_radius)
    .filter((task) => getTaskSafety(task).status !== 'blocked')
    .map((task) => ({ task, score: scoreTaskForUser(task, user, positiveConcepts, postersById.get(task.poster_id)) }))
    .filter(({ score }) => score > 0.08)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return new Date(right.task.created_at).getTime() - new Date(left.task.created_at).getTime();
    });

  return ranked.map(({ task }) => task);
}

export function getTaskSafety(task: Pick<Task, 'title' | 'description' | 'required_skills' | 'category' | 'ai_match_profile'>): AiMatchSafety {
  const localSafety = classifySafety([
    task.title,
    task.description,
    task.category,
    task.required_skills,
  ]);
  const aiSafety = task.ai_match_profile?.safety;

  if (!aiSafety) {
    return localSafety;
  }

  if (aiSafety.status === 'blocked' || localSafety.status === 'blocked') {
    return {
      status: 'blocked',
      reasons: Array.from(new Set([...aiSafety.reasons, ...localSafety.reasons])),
    };
  }

  if (aiSafety.status === 'review' || localSafety.status === 'review') {
    return {
      status: 'review',
      reasons: Array.from(new Set([...aiSafety.reasons, ...localSafety.reasons])),
    };
  }

  return aiSafety;
}

function scoreTaskForUser(task: Task, user: Profile, positiveConcepts: Set<string>, poster?: Profile) {
  const taskProfile = task.ai_match_profile ?? buildLocalTaskMatchProfile(task);
  const userProfile = user.ai_match_profile ?? buildLocalUserMatchProfile(user);
  const taskCategories = getTaskCategoryLabels(task);
  const directCategoryScore = ratioOverlap(user.interests, taskCategories);
  const semanticScore = Math.max(
    ratioOverlap(userProfile.concepts, taskProfile.concepts),
    ratioOverlap(userProfile.preferred_categories, taskProfile.semantic_categories),
  );
  const engagementScore = positiveConcepts.size
    ? ratioOverlap(Array.from(positiveConcepts), [...taskProfile.concepts, ...taskProfile.semantic_categories])
    : 0;
  const exactSkillCount = skillMatchCount(user.interests, taskCategories);
  const exactSkillBonus = exactSkillCount > 0 ? Math.min(0.08, exactSkillCount * 0.025) : 0;
  const distanceScore = clamp01(1 - milesBetween(user.location, task.location) / Math.max(user.search_radius, 1));
  const freshnessScore = freshnessFromCreatedAt(task.created_at);
  const effectiveFreshnessScore = task.is_boosted ? Math.max(freshnessScore, 0.45) : freshnessScore;
  const boostScore = task.is_boosted ? Math.min(1, 0.62 + task.boost_days / 10) : 0;
  const relevanceForBoost = Math.max(semanticScore, directCategoryScore, engagementScore, exactSkillBonus);
  const boostRelevanceMultiplier = task.is_boosted ? clamp01(0.35 + relevanceForBoost * 1.3) : 0;
  const paidBoostLift = boostScore * boostRelevanceMultiplier;
  const posterTrustScore = clamp01(
    (poster?.is_verified ? 0.35 : 0) +
      Math.min(poster?.posted_vouch_count ?? 0, 40) / 80 +
      ((poster?.rating_count ?? 0) >= 5 ? ((poster?.rating ?? 5) - 3) / 4 : 0.1),
  );
  const safety = getTaskSafety(task);
  const safetyPenalty = safety.status === 'review' ? 0.18 : 0;

  return clamp01(
    semanticScore * 0.4 +
      directCategoryScore * 0.18 +
      distanceScore * 0.12 +
      effectiveFreshnessScore * 0.08 +
      engagementScore * 0.07 +
      posterTrustScore * 0.05 +
      paidBoostLift * 0.20 +
      exactSkillBonus -
      safetyPenalty,
  );
}

function buildEngagementConcepts(tasks: Task[], matches: GigMatch[], userId: string) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const concepts = new Set<string>();

  matches
    .filter((match) => match.doer_id === userId)
    .forEach((match) => {
      const task = taskById.get(match.task_id);

      if (!task) {
        return;
      }

      const profile = task.ai_match_profile ?? buildLocalTaskMatchProfile(task);
      [...profile.concepts, ...profile.semantic_categories].forEach((concept) => concepts.add(concept));
    });

  return concepts;
}

async function requestAiMatchProfile<TInput, TResponse>(kind: string, input: TInput): Promise<TResponse | null> {
  if (!AI_MATCH_ENDPOINT) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_MATCH_TIMEOUT_MS);

  try {
    const response = await fetch(AI_MATCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        kind,
        model_hint: 'gpt-5.5',
        input,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildLocalTaskMatchProfile(task: TaskProfileInput): AiTaskMatchProfile {
  const text = [
    task.title,
    task.description,
    task.category,
    task.required_skills,
    task.location_label,
    task.date_window,
  ];
  const concepts = extractConcepts(text);
  const categoryConcepts = normalizeList([task.category, ...task.required_skills]);

  return {
    source: 'local',
    summary: truncate(`${task.title}. ${task.description}`, TASK_SUMMARY_MAX_LENGTH),
    concepts: unique([...categoryConcepts, ...concepts]),
    semantic_categories: unique([...categoryConcepts, ...concepts.filter((concept) => concept in conceptLexicon)]),
    safety: classifySafety(text),
    generated_at: new Date().toISOString(),
  };
}

function buildLocalUserMatchProfile(profile: UserProfileInput): AiUserMatchProfile {
  const age = calculateAge(profile.birth_date);
  const categories = normalizeList([...profile.interests, ...profile.skills]);
  const concepts = extractConcepts([profile.bio, categories, age ? `age ${age}` : '']);

  return {
    source: 'local',
    summary: truncate(
      `${age ? `${age} year old ` : ''}hustler interested in ${profile.interests.join(', ') || 'nearby gigs'}. ${profile.bio}`,
      PROFILE_SUMMARY_MAX_LENGTH,
    ),
    concepts: unique([...categories, ...concepts]),
    preferred_categories: unique([...categories, ...concepts.filter((concept) => concept in conceptLexicon)]),
    generated_at: new Date().toISOString(),
  };
}

function normalizeTaskMatchProfile(remote: TaskAiResponse, fallback: AiTaskMatchProfile): AiTaskMatchProfile {
  const safety = normalizeSafety(
    remote.safety,
    [
      remote.nsfw ? 'AI flagged explicit or unsafe content.' : null,
      remote.profanity ? 'AI flagged profanity in gig content.' : null,
    ].filter((reason): reason is string => Boolean(reason)),
  );

  return {
    source: 'ai',
    summary: truncate(cleanString(remote.summary) || fallback.summary, TASK_SUMMARY_MAX_LENGTH),
    concepts: normalizeList(remote.concepts).length > 0 ? normalizeList(remote.concepts) : fallback.concepts,
    semantic_categories:
      normalizeList(remote.semantic_categories).length > 0
        ? normalizeList(remote.semantic_categories)
        : fallback.semantic_categories,
    safety: mergeSafety(safety, fallback.safety),
    generated_at: new Date().toISOString(),
  };
}

function normalizeUserMatchProfile(remote: UserAiResponse, fallback: AiUserMatchProfile): AiUserMatchProfile {
  return {
    source: 'ai',
    summary: truncate(cleanString(remote.summary) || fallback.summary, PROFILE_SUMMARY_MAX_LENGTH),
    concepts: normalizeList(remote.concepts).length > 0 ? normalizeList(remote.concepts) : fallback.concepts,
    preferred_categories:
      normalizeList(remote.preferred_categories).length > 0
        ? normalizeList(remote.preferred_categories)
        : fallback.preferred_categories,
    generated_at: new Date().toISOString(),
  };
}

function normalizeSafety(value: unknown, extraReasons: string[] = []): AiMatchSafety {
  const row = value as Partial<AiMatchSafety> | undefined;
  const status = row?.status === 'blocked' || row?.status === 'review' || row?.status === 'safe' ? row.status : 'safe';
  const reasons = normalizeList(row?.reasons);

  extraReasons.forEach((reason) => reasons.push(reason.toLowerCase()));

  return {
    status: extraReasons.length > 0 && status === 'safe' ? 'blocked' : status,
    reasons: unique(reasons),
  };
}

function mergeSafety(left: AiMatchSafety, right: AiMatchSafety): AiMatchSafety {
  if (left.status === 'blocked' || right.status === 'blocked') {
    return { status: 'blocked', reasons: unique([...left.reasons, ...right.reasons]) };
  }

  if (left.status === 'review' || right.status === 'review') {
    return { status: 'review', reasons: unique([...left.reasons, ...right.reasons]) };
  }

  return { status: 'safe', reasons: unique([...left.reasons, ...right.reasons]) };
}

function classifySafety(parts: unknown[]): AiMatchSafety {
  const text = stringifyParts(parts);
  const blockedReasons = blockedSafetyPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `blocked:${pattern.source}`);

  if (blockedReasons.length > 0) {
    return { status: 'blocked', reasons: blockedReasons };
  }

  const reviewReasons = reviewSafetyPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `review:${pattern.source}`);

  if (reviewReasons.length > 0) {
    return { status: 'review', reasons: reviewReasons };
  }

  return { status: 'safe', reasons: [] };
}

function extractConcepts(parts: unknown[]) {
  const text = stringifyParts(parts);
  const tokens = tokenize(text);
  const concepts = new Set<string>();

  for (const [concept, keywords] of Object.entries(conceptLexicon)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      concepts.add(concept);
    }
  }

  tokens.forEach((token) => {
    if (token.length > 2 && !stopWords.has(token)) {
      concepts.add(token);
    }
  });

  return Array.from(concepts).slice(0, 24);
}

function ratioOverlap(left: string[], right: string[]) {
  const leftSet = new Set(normalizeList(left));
  const rightSet = new Set(normalizeList(right));

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let matches = 0;
  leftSet.forEach((item) => {
    if (rightSet.has(item)) {
      matches += 1;
    }
  });

  return matches / Math.max(3, Math.min(leftSet.size, rightSet.size));
}

function freshnessFromCreatedAt(value: string) {
  const createdAt = Date.parse(value);

  if (!Number.isFinite(createdAt)) {
    return 0.35;
  }

  const ageDays = Math.max(0, (Date.now() - createdAt) / 86_400_000);
  return clamp01(Math.exp(-ageDays / 14));
}

function stableSignature(parts: unknown[]) {
  return normalizeList(parts).join('|');
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return tokenize(String(value ?? ''));
  }

  return unique(value.flatMap((item) => tokenize(String(item ?? ''))));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !stopWords.has(item));
}

function stringifyParts(parts: unknown[]) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) => String(part ?? '').toLowerCase())
    .join(' ');
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1).trim()}...`;
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
