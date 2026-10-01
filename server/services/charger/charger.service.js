import Charger from '../../models/Charger.js';
import { calculateDistanceKm, toGeoJSONPoint } from '../../utils/geo.js';

/**
 * Rule-Based Smart Score Recommendation Algorithm
 * Combines distance, price, power, connector, availability, and ratings.
 * (Not labeled as ML/AI)
 */
export const calculateSmartScore = ({
  distanceKm = 2.0,
  pricePerHour = 25,
  powerOutputKw = 7.4,
  rating = 4.5,
  isAvailable = true,
}) => {
  let score = 80; // Base score

  // Distance Factor (closer = higher)
  if (distanceKm < 1.0) score += 10;
  else if (distanceKm < 3.0) score += 5;
  else if (distanceKm > 10.0) score -= 10;

  // Price Factor (lower = higher)
  if (pricePerHour <= 15) score += 8;
  else if (pricePerHour <= 30) score += 3;
  else if (pricePerHour > 60) score -= 8;

  // Power Output Factor (faster = higher)
  if (powerOutputKw >= 50) score += 10;
  else if (powerOutputKw >= 22) score += 6;
  else if (powerOutputKw >= 7.4) score += 2;

  // Rating Factor
  score += (rating - 3) * 3;

  // Availability Factor
  if (!isAvailable) score -= 20;

  return Math.min(99, Math.max(50, Math.round(score)));
};

export const findNearbyChargers = async ({ latitude, longitude, radiusKm = 25, filters = {} }) => {
  const maxDistanceMeters = radiusKm * 1000;
  const lat = Number(latitude);
  const lng = Number(longitude);

  const query = {
    'location.coordinates': {
      $near: {
        $geometry: toGeoJSONPoint(lat, lng),
        $maxDistance: maxDistanceMeters,
      },
    },
    isActive: true,
    title: { $nin: ['CHG-PHASE10-001', 'CHG-PHASE11-001', 'CHG-PHASE12-001', 'CHG-NCR-001'] },
  };

  if (filters.chargerType) query.chargerType = new RegExp(filters.chargerType, 'i');
  if (filters.connectorType) query.connectorType = new RegExp(filters.connectorType, 'i');
  if (filters.minPower) query.powerOutput = { $gte: Number(filters.minPower) };
  if (filters.maxPrice) query.pricePerHour = { $lte: Number(filters.maxPrice) };

  const chargers = await Charger.find(query).populate('owner', 'name email phone avatar');

  return chargers.map((charger) => {
    const cObj = charger.toObject();
    const cLat = cObj.location.coordinates[1];
    const cLng = cObj.location.coordinates[0];
    const dist = calculateDistanceKm(lat, lng, cLat, cLng);

    cObj.distanceKm = dist;
    cObj.smartScore = calculateSmartScore({
      distanceKm: dist,
      pricePerHour: cObj.pricePerHour,
      powerOutputKw: cObj.powerOutput,
      rating: cObj.rating,
      isAvailable: cObj.isAvailable,
    });

    return cObj;
  });
};
