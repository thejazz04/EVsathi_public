const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const normalizePlace = (place) => {
  if (!place) return null;
  const lat = parseFloat(place.lat);
  const lng = parseFloat(place.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    displayName: place.display_name || '',
    raw: place,
  };
};

export const geocodeService = {
  async search(query, limit = 5) {
    const trimmed = query?.trim();
    if (!trimmed) throw new Error('Please enter a location');

    const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(trimmed)}&limit=${limit}&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('No matching location found');
    return data.map(normalizePlace).filter(Boolean);
  },

  async first(query) {
    const results = await this.search(query, 1);
    return results[0];
  },
};

export default geocodeService;
