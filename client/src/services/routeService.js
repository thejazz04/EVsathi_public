const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

const parseRoute = (data) => {
  const route = data?.routes?.[0];
  if (!route || !route.geometry?.coordinates) return { coords: [], distanceKm: null, durationMin: null };
  const coords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const distanceKm = route.distance ? route.distance / 1000 : null;
  const durationMin = route.duration ? route.duration / 60 : null;
  return { coords, distanceKm, durationMin };
};

export const routeService = {
  async getRoute(start, end) {
    if (!start || !end) throw new Error('Start and end locations are required');
    const url = `${OSRM_BASE_URL}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Unable to fetch route');
    }
    const data = await response.json();
    if (data.code !== 'Ok') {
      throw new Error(data.message || 'Route not found');
    }
    return parseRoute(data);
  },
};

export default routeService;
