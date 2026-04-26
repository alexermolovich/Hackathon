import type { Profile } from './gig-types';

export const RATING_VISIBILITY_THRESHOLD = 5;

export function canShowDoerRating(profile: Profile) {
  return profile.vouch_count >= RATING_VISIBILITY_THRESHOLD;
}

export function canShowPosterRating(profile: Profile) {
  return profile.posted_vouch_count >= RATING_VISIBILITY_THRESHOLD;
}

export function canShowAnyRating(profile: Profile) {
  return profile.rating_count >= RATING_VISIBILITY_THRESHOLD && profile.vouch_count + profile.posted_vouch_count >= RATING_VISIBILITY_THRESHOLD;
}

export function formatVisibleRating(profile: Profile, role: 'doer' | 'poster' | 'any') {
  const canShow =
    role === 'doer' ? canShowDoerRating(profile) : role === 'poster' ? canShowPosterRating(profile) : canShowAnyRating(profile);

  return canShow ? profile.rating.toFixed(2) : 'New';
}

export function visibleRatingValue(profile: Profile, role: 'doer' | 'poster' | 'any') {
  const canShow =
    role === 'doer' ? canShowDoerRating(profile) : role === 'poster' ? canShowPosterRating(profile) : canShowAnyRating(profile);

  return canShow ? profile.rating : 0;
}
