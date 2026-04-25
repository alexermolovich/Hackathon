import type { Coordinates, EnrichedMatch, GigMatch, Profile, Task } from './gig-types';

const EARTH_RADIUS_MILES = 3958.8;

export function createUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function milesBetween(from: Coordinates, to: Coordinates) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const originLat = toRadians(from.latitude);
  const targetLat = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(from: Coordinates, to: Coordinates) {
  const distance = milesBetween(from, to);
  return distance < 0.1 ? 'Nearby' : `${distance.toFixed(1)} miles away`;
}

export function skillMatchCount(userSkills: string[], requiredSkills: string[]) {
  const normalized = new Set(userSkills.map((skill) => skill.toLowerCase()));
  return requiredSkills.filter((skill) => normalized.has(skill.toLowerCase())).length;
}

export function buildDeck(tasks: Task[], user: Profile) {
  const interestedCategories = new Set(user.interests.map((category) => category.toLowerCase()));
  const nearby = tasks
    .filter((task) => task.status === 'open')
    .filter((task) => task.poster_id !== user.id)
    .filter((task) => milesBetween(user.location, task.location) <= user.search_radius)
    .filter((task) => interestedCategories.size === 0 || interestedCategories.has(task.category.toLowerCase()))
    .sort((a, b) => milesBetween(user.location, a.location) - milesBetween(user.location, b.location));

  const boosted = nearby.filter((task) => task.is_boosted).slice(0, 3);
  const boostedIds = new Set(boosted.map((task) => task.id));
  const regular = nearby.filter((task) => !boostedIds.has(task.id));

  return [...boosted, ...regular];
}

export function enrichMatches(matches: GigMatch[], tasks: Task[], profiles: Profile[]) {
  return matches
    .map((match) => {
      const task = tasks.find((item) => item.id === match.task_id);
      const doer = profiles.find((item) => item.id === match.doer_id);
      const poster = task ? profiles.find((item) => item.id === task.poster_id) : undefined;

      if (!task || !doer || !poster) {
        return null;
      }

      return { ...match, task, doer, poster } satisfies EnrichedMatch;
    })
    .filter((match): match is EnrichedMatch => Boolean(match));
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function calculateAge(birthDate: string) {
  const date = new Date(birthDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDelta = today.getMonth() - date.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return age;
}
