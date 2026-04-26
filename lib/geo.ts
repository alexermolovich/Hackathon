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

const APPROXIMATE_PLACES = [
  { name: 'Downtown Rapid City', coordinate: { latitude: 44.0814, longitude: -103.2295 } },
  { name: 'West Rapid City', coordinate: { latitude: 44.0687, longitude: -103.2479 } },
  { name: 'North Rapid City', coordinate: { latitude: 44.1032, longitude: -103.2386 } },
  { name: 'East Rapid City', coordinate: { latitude: 44.0848, longitude: -103.1984 } },
  { name: 'Robbinsdale', coordinate: { latitude: 44.0482, longitude: -103.2564 } },
  { name: 'Black Hawk', coordinate: { latitude: 44.1511, longitude: -103.3074 } },
  { name: 'Box Elder', coordinate: { latitude: 44.1125, longitude: -103.0682 } },
  { name: 'Summerset', coordinate: { latitude: 44.1892, longitude: -103.3438 } },
  { name: 'Keystone', coordinate: { latitude: 43.8958, longitude: -103.4182 } },
  { name: 'Hill City', coordinate: { latitude: 43.9325, longitude: -103.5752 } },
] satisfies { name: string; coordinate: Coordinates }[];

export function approximateLocationLabel(coordinate: Coordinates) {
  const nearest = APPROXIMATE_PLACES.map((place) => ({
    ...place,
    distance: milesBetween(coordinate, place.coordinate),
  })).sort((left, right) => left.distance - right.distance)[0];

  if (!nearest || nearest.distance > 35) {
    return 'Nearby area';
  }

  if (nearest.distance < 1.5) {
    return `${nearest.name} area`;
  }

  const direction = cardinalDirection(nearest.coordinate, coordinate);
  return `${direction} of ${nearest.name}`;
}

function milesBetween(from: Coordinates, to: Coordinates) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const originLat = toRadians(from.latitude);
  const targetLat = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cardinalDirection(from: Coordinates, to: Coordinates) {
  const latitudeDelta = to.latitude - from.latitude;
  const longitudeDelta = to.longitude - from.longitude;
  const vertical = latitudeDelta > 0.01 ? 'north' : latitudeDelta < -0.01 ? 'south' : '';
  const horizontal = longitudeDelta > 0.01 ? 'east' : longitudeDelta < -0.01 ? 'west' : '';

  if (vertical && horizontal) {
    return `${vertical}${horizontal}`;
  }

  return vertical || horizontal || 'near';
}
