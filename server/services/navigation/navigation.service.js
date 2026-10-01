import { calculateOsrmRoute } from './providers/osrm.provider.js';
import Charger from '../../models/Charger.js';
import { calculateDistanceKm } from '../../utils/geo.js';

const navigationProvider = process.env.NAVIGATION_PROVIDER || 'osrm';

/**
 * Replaceable Navigation Service Abstraction
 */
export const getRoute = async (start, end) => {
  if (navigationProvider === 'osrm') {
    return await calculateOsrmRoute(start, end);
  }
  return await calculateOsrmRoute(start, end);
};

export const getReroute = async (currentLocation, destination, previousRouteId) => {
  const newRoute = await getRoute(currentLocation, destination);
  return {
    ...newRoute,
    rerouted: true,
    previousRouteId,
  };
};

export const getNearbyChargersOnRoute = async (lat, lng, radiusKm = 10) => {
  const chargers = await Charger.find({
    isActive: true,
    isAvailable: true,
  }).limit(10);

  return chargers
    .map((c) => {
      const obj = c.toObject();
      const dist = calculateDistanceKm(lat, lng, obj.location.coordinates[1], obj.location.coordinates[0]);
      obj.distanceKm = dist;
      return obj;
    })
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
};
