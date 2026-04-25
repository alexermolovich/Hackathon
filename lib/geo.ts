import type { Coordinates } from './gig-types';

export const RAPID_CITY_CENTER: Coordinates = {
  latitude: 44.080543,
  longitude: -103.231015,
};

export const DEFAULT_TASK_RADIUS_MILES = 8;

export const RAPID_CITY_VIEW_DELTA = {
  latitudeDelta: 0.28,
  longitudeDelta: 0.24,
};

const RAPID_CITY_BOUNDS = {
  north: 44.145,
  south: 44.025,
  west: -103.335,
  east: -103.135,
};

export type RapidCityDot = {
  id: string;
  coordinate: Coordinates;
  xPercent: number;
  yPercent: number;
};

export function mapRapidCityDots(points: { id: string; coordinate: Coordinates }[]): RapidCityDot[] {
  return points.map((point) => {
    const longitude = Math.min(Math.max(point.coordinate.longitude, RAPID_CITY_BOUNDS.west), RAPID_CITY_BOUNDS.east);
    const latitude = Math.min(Math.max(point.coordinate.latitude, RAPID_CITY_BOUNDS.south), RAPID_CITY_BOUNDS.north);

    return {
      id: point.id,
      coordinate: { latitude, longitude },
      xPercent: ((longitude - RAPID_CITY_BOUNDS.west) / (RAPID_CITY_BOUNDS.east - RAPID_CITY_BOUNDS.west)) * 100,
      yPercent: (1 - (latitude - RAPID_CITY_BOUNDS.south) / (RAPID_CITY_BOUNDS.north - RAPID_CITY_BOUNDS.south)) * 100,
    };
  });
}

export const RAPID_CITY_TASK_DOTS = mapRapidCityDots([
  { id: 'rapid-city-task-dot-1', coordinate: { latitude: 44.0814, longitude: -103.2295 } },
  { id: 'rapid-city-task-dot-2', coordinate: { latitude: 44.0482, longitude: -103.2564 } },
]);
