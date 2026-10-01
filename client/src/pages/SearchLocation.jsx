import { useState } from 'react';
import { Link } from 'react-router-dom';
import Map from '../components/Map.jsx';
import { chargerService } from '../services/chargerService.js';
import { geocodeService } from '../services/geocodeService.js';

const DEFAULT_CENTER = { lat: 23.0225, lng: 72.5714 };

const SearchLocation = () => {
  const [chargers, setChargers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedChargerId, setSelectedChargerId] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [radius, setRadius] = useState(10);
  const [chargerType, setChargerType] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [center, setCenter] = useState(DEFAULT_CENTER);

  const runGeocode = async (query) => {
    const place = await geocodeService.first(query);
    if (!place) throw new Error('Location not found');
    return { lat: place.lat, lng: place.lng };
  };

  const handleCitySearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchError('Enter a city or area');
      return;
    }

    try {
      setSearching(true);
      setSearchError('');
      const place = await runGeocode(searchQuery);
      setCenter({ lat: place.lat, lng: place.lng });

      const response = await chargerService.search({
        lat: place.lat,
        lng: place.lng,
        radius,
        chargerType: chargerType || undefined,
        maxPrice: maxPrice || undefined,
      });
      setChargers(response.data?.chargers || []);
      setSelectedChargerId(null);
    } catch (err) {
      setSearchError(err.message || 'Unable to search this area');
      setChargers([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="container mx-auto space-y-4 px-4 py-6 sm:py-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Find chargers anywhere</h1>
            <p className="text-sm text-gray-600">Type a city or area and we will fly the map there.</p>
          </div>
          <form onSubmit={handleCitySearch} className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 focus-within:ring-2 focus-within:ring-primary-500">
              <span className="text-xl">🔎</span>
              <input
                type="text"
                placeholder="Enter city or area"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary min-w-[130px] w-full lg:w-auto"
              disabled={searching}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <span>Radius (km)</span>
            <input
              type="number"
              min="1"
              max="200"
              step="0.5"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="input w-24 text-right"
            />
          </label>
          <select
            value={chargerType}
            onChange={(e) => setChargerType(e.target.value)}
            className="input rounded-xl border-gray-200 bg-gray-50"
          >
            <option value="">All charger types</option>
            <option value="Level 1">Level 1</option>
            <option value="Level 2">Level 2</option>
            <option value="DC Fast">DC Fast</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Max ₹/hr (optional)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="input rounded-xl border-gray-200 bg-gray-50"
          />
        </div>

        {searchError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchError}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="inline-flex w-full rounded-xl bg-gray-100 p-1 sm:w-auto">
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
              viewMode === 'list' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'
            }`}
            onClick={() => setViewMode('list')}
          >
            List View
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
              viewMode === 'map' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'
            }`}
            onClick={() => setViewMode('map')}
          >
            Map View
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${viewMode === 'map' ? 'lg:grid-cols-1' : 'lg:grid-cols-[380px_1fr]'}`}>
        {viewMode !== 'map' && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm lg:h-[calc(100vh-230px)] lg:overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Chargers</p>
              <h2 className="text-xl font-bold text-gray-900">{chargers.length} results</h2>
            </div>
            <div className="divide-y divide-gray-100 lg:h-[calc(100%-72px)] lg:overflow-y-auto">
              {chargers.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">Search a location to view chargers.</div>
              ) : (
                chargers.map((charger) => {
                  const isActive = selectedChargerId === charger._id;
                  return (
                    <div
                      key={charger._id}
                      className={`group flex cursor-pointer gap-3 px-4 py-3 transition hover:bg-gray-50 ${isActive ? 'bg-primary-50' : ''}`}
                      onMouseEnter={() => setSelectedChargerId(charger._id)}
                      onMouseLeave={() => setSelectedChargerId(null)}
                      onClick={() => setSelectedChargerId(charger._id)}
                    >
                      <div className="min-w-0 flex-1">
                        <Link to={`/chargers/${charger._id}`} className="block truncate text-base font-semibold text-gray-900 hover:underline">
                          {charger.title}
                        </Link>
                        <p className="truncate text-sm text-gray-600">{charger.location?.address || `${charger.location?.city || ''}, ${charger.location?.state || ''}`}</p>
                        <p className="text-xs text-gray-500">{charger.chargerType} • {charger.connectorType}</p>
                      </div>
                      <p className="text-lg font-bold text-primary-600">₹{charger.pricePerHour}/hr</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="h-[55vh] overflow-hidden rounded-3xl border border-gray-200 shadow-lg lg:sticky lg:top-4 lg:h-[calc(100vh-230px)]">
          <Map
            chargers={chargers}
            zoom={12}
            onMarkerClick={(chargerId) => setSelectedChargerId(chargerId)}
            selectedChargerId={selectedChargerId}
            center={[center.lat, center.lng]}
          />
        </div>
      </div>
    </div>
  );
};

export default SearchLocation;
