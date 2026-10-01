import logger from '../../../utils/logger.js';

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org/route/v1/driving';

/**
 * Initial OSRM Development Routing Provider
 * (Not labeled as live traffic-aware)
 */
export const calculateOsrmRoute = async (start, end) => {
  if (!start || !end || start.lat == null || start.lng == null || end.lat == null || end.lng == null) {
    throw new Error('Start and end coordinates (lat, lng) are required');
  }

  const url = `${OSRM_BASE_URL}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`OSRM API error HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
      throw new Error(data.message || 'Route not found');
    }

    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const distanceKm = Number((route.distance / 1000).toFixed(2));
    const durationMin = Number((route.duration / 60).toFixed(1));

    return {
      coords,
      distanceKm,
      durationMin,
      eta: new Date(Date.now() + durationMin * 60 * 1000).toISOString(),
      provider: 'OSRM_DEV',
      isTrafficAware: false,
    };
  } catch (error) {
    logger.warn('OSRM route fetch failed, using fallback straight-line calculation', { error: error.message });
    // Fallback straight-line route calculation
    const distanceKm = Number((Math.hypot(end.lat - start.lat, end.lng - start.lng) * 111).toFixed(2));
    const durationMin = Number((distanceKm * 2).toFixed(1));
    return {
      coords: [{ lat: start.lat, lng: start.lng }, { lat: end.lat, lng: end.lng }],
      distanceKm,
      durationMin,
      eta: new Date(Date.now() + durationMin * 60 * 1000).toISOString(),
      provider: 'FALLBACK_LINE',
      isTrafficAware: false,
    };
  }
};
