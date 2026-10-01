import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as turf from '@turf/turf';
import Map from '../components/Map.jsx';
import { chargerService } from '../services/chargerService.js';
import { geocodeService } from '../services/geocodeService.js';
import { routeService } from '../services/routeService.js';
import { MapPin, Navigation, ArrowRight, Clock, Milestone, RotateCcw, ExternalLink } from 'lucide-react';

const POPULAR_LOCATIONS = [
  'Mysore',
  'Srirangapatna',
  'Mysore Palace',
  'Chamundi Hills',
  'KRS Dam',
  'Brindavan Gardens',
  'Infosys Mysore',
];

const KNOWN_COORDINATES = {
  'mysore': { lat: 12.3051, lng: 76.6552, label: 'Mysore, Karnataka' },
  'mysuru': { lat: 12.3051, lng: 76.6552, label: 'Mysuru, Karnataka' },
  'srirangapatna': { lat: 12.4218, lng: 76.6932, label: 'Srirangapatna, Karnataka' },
  'mysore palace': { lat: 12.3051, lng: 76.6552, label: 'Mysore Palace, Mysore' },
  'chamundi hills': { lat: 12.2743, lng: 76.6710, label: 'Chamundi Hills, Mysore' },
  'krs dam': { lat: 12.4244, lng: 76.5728, label: 'KRS Dam, Krishnarajasagara' },
  'brindavan gardens': { lat: 12.4225, lng: 76.5742, label: 'Brindavan Gardens, KRS' },
  'infosys mysore': { lat: 12.3582, lng: 76.5936, label: 'Infosys Campus, Hebbal, Mysore' },
};

const DEFAULT_CENTER = { lat: 12.3051, lng: 76.6552 };

const PlanRoute = () => {
  const [startInput, setStartInput] = useState('Mysore');
  const [endInput, setEndInput] = useState('');
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);

  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const startRef = useRef(null);
  const endRef = useRef(null);

  const [corridorRadiusKm, setCorridorRadiusKm] = useState(5);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [hasCalculatedRoute, setHasCalculatedRoute] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [allChargers, setAllChargers] = useState([]);
  const [selectedChargerId, setSelectedChargerId] = useState(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (startRef.current && !startRef.current.contains(e.target)) {
        setShowStartSuggestions(false);
      }
      if (endRef.current && !endRef.current.contains(e.target)) {
        setShowEndSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredStartSuggestions = POPULAR_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(startInput.toLowerCase().trim())
  );

  const filteredEndSuggestions = POPULAR_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(endInput.toLowerCase().trim())
  );

  const resolveMyLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error('Unable to retrieve your current location. Please type a city name.'))
      );
    });

  const resolveLocation = async (input, type) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'my location') {
      const coords = await resolveMyLocation();
      const locObj = { ...coords, label: 'My Location' };
      if (type === 'start') setStartLocation(locObj);
      if (type === 'end') setEndLocation(locObj);
      return locObj;
    }

    const key = trimmed.toLowerCase();
    if (KNOWN_COORDINATES[key]) {
      const coords = KNOWN_COORDINATES[key];
      if (type === 'start') setStartLocation(coords);
      if (type === 'end') setEndLocation(coords);
      return coords;
    }

    // Fallback to nominatim geocodeService
    const place = await geocodeService.first(trimmed);
    if (!place) {
      throw new Error(`Location not found: "${trimmed}". Please select a suggestion or check spelling.`);
    }
    const coords = { lat: place.lat, lng: place.lng, label: place.displayName || trimmed };
    if (type === 'start') setStartLocation(coords);
    if (type === 'end') setEndLocation(coords);
    return coords;
  };

  const handleRouteSubmit = async (e) => {
    if (e) e.preventDefault();
    setShowStartSuggestions(false);
    setShowEndSuggestions(false);

    if (!startInput.trim()) {
      setRouteError('Please enter a starting point');
      return;
    }
    if (!endInput.trim()) {
      setRouteError('Please enter a destination');
      return;
    }

    setRouteLoading(true);
    setRouteError('');

    try {
      const resolvedStart = await resolveLocation(startInput, 'start');
      const resolvedEnd = await resolveLocation(endInput, 'end');

      const { coords, distanceKm, durationMin } = await routeService.getRoute(resolvedStart, resolvedEnd);

      if (!coords || !coords.length) {
        setRouteError('No driving route found between these locations.');
        setRouteCoords([]);
        setRouteInfo(null);
        setHasCalculatedRoute(true);
        return;
      }

      setRouteCoords(coords);
      setRouteInfo({ distanceKm, durationMin });
      setHasCalculatedRoute(true);

      // Fetch legitimate marketplace chargers
      const res = await chargerService.getChargers({ limit: 100 });
      const list = res.data?.chargers || res.data || [];
      const legitimateList = Array.isArray(list)
        ? list.filter(
            (c) =>
              !c.stationId?.startsWith('CHG-PHASE') &&
              !c.stationId?.startsWith('CHG-NCR') &&
              !c.title?.toLowerCase().includes('sample') &&
              !c.name?.toLowerCase().includes('sample')
          )
        : [];

      setAllChargers(legitimateList);
      setSelectedChargerId(null);
    } catch (err) {
      setRouteError(err.message || 'Unable to plan route. Please try again.');
      setRouteCoords([]);
      setRouteInfo(null);
    } finally {
      setRouteLoading(false);
    }
  };

  // Filter chargers along route corridor
  const chargersOnRoute = useMemo(() => {
    if (!routeCoords.length || !allChargers.length) return [];

    try {
      const line = turf.lineString(routeCoords.map((pt) => [pt.lng, pt.lat]));
      const radius = parseFloat(corridorRadiusKm) || 5;

      return allChargers.filter((charger) => {
        const lat = charger.location?.coordinates?.[1] ?? charger.location?.lat ?? charger.lat;
        const lng = charger.location?.coordinates?.[0] ?? charger.location?.lng ?? charger.lng;

        if (typeof lat !== 'number' || typeof lng !== 'number') return false;

        const distance = turf.pointToLineDistance(turf.point([lng, lat]), line, {
          units: 'kilometers',
        });

        return distance <= radius;
      });
    } catch {
      return [];
    }
  }, [allChargers, routeCoords, corridorRadiusKm]);

  const handleClear = () => {
    setRouteCoords([]);
    setRouteInfo(null);
    setRouteError('');
    setHasCalculatedRoute(false);
    setSelectedChargerId(null);
    setAllChargers([]);
  };

  const formatETA = (minutes) => {
    if (!Number.isFinite(minutes)) return '--';
    const total = Math.max(0, Math.round(minutes));
    const hrs = Math.floor(total / 60);
    const mins = total % 60;
    if (hrs === 0) return `${mins} mins`;
    return `${hrs} hr ${mins} mins`;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-5">
      {/* Top Header & Search Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Plan your route</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your start and destination to discover EV chargers along your journey.
            </p>
          </div>

          {/* Corridor Radius Control */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="font-semibold text-slate-700">Corridor:</span>
            <input
              type="number"
              min="1"
              max="30"
              step="1"
              value={corridorRadiusKm}
              onChange={(e) => setCorridorRadiusKm(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-500 font-medium">km</span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleRouteSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            {/* Start Location Input with Autocomplete */}
            <div className="relative" ref={startRef}>
              <label className="block text-xs font-bold text-slate-700 mb-1">Starting point</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <input
                  type="text"
                  value={startInput}
                  onChange={(e) => {
                    setStartInput(e.target.value);
                    setShowStartSuggestions(true);
                  }}
                  onFocus={() => setShowStartSuggestions(true)}
                  placeholder="e.g. Mysore, Infosys Mysore"
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setStartInput('My Location');
                    setShowStartSuggestions(false);
                  }}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline shrink-0"
                >
                  My Location
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {showStartSuggestions && filteredStartSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden py-1 max-h-56 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Suggested Locations
                  </div>
                  {filteredStartSuggestions.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setStartInput(loc);
                        setShowStartSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition flex items-center gap-2 font-medium"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{loc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination Input with Autocomplete */}
            <div className="relative" ref={endRef}>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <Navigation className="w-4 h-4 text-red-500 shrink-0" />
                <input
                  type="text"
                  value={endInput}
                  onChange={(e) => {
                    setEndInput(e.target.value);
                    setShowEndSuggestions(true);
                  }}
                  onFocus={() => setShowEndSuggestions(true)}
                  placeholder="e.g. Srirangapatna, Chamundi Hills"
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>

              {/* Suggestions Dropdown */}
              {showEndSuggestions && filteredEndSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden py-1 max-h-56 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Suggested Locations
                  </div>
                  {filteredEndSuggestions.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setEndInput(loc);
                        setShowEndSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition flex items-center gap-2 font-medium"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{loc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {routeError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700">
              {routeError}
            </div>
          )}

          {/* Action Buttons & Route Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <button
                type="submit"
                disabled={routeLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {routeLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    Show route
                  </>
                )}
              </button>

              {hasCalculatedRoute && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={routeLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {/* Route Stats */}
            {routeInfo && (
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-100">
                  <Milestone className="w-3.5 h-3.5 text-emerald-600" />
                  {routeInfo.distanceKm ? `${routeInfo.distanceKm.toFixed(1)} km` : '--'}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 font-bold px-3 py-1 rounded-full border border-blue-100">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  {formatETA(routeInfo.durationMin)}
                </span>
                {startLocation && endLocation && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${startLocation.lat},${startLocation.lng}&destination=${endLocation.lat},${endLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold ml-2 hover:underline"
                    title="Open in external Google Maps"
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Main Content: Left Charger List + Right Leaflet Map */}
      <div className="grid gap-5 lg:grid-cols-[380px_1fr] items-start">
        {/* Left Column: Chargers Along Route */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[580px]">
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Chargers along your route</h2>
              {hasCalculatedRoute && (
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  {chargersOnRoute.length} {chargersOnRoute.length === 1 ? 'charger' : 'chargers'} within {corridorRadiusKm} km
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {!hasCalculatedRoute ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Navigation className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-medium text-slate-600 max-w-[220px]">
                  Enter a start and destination to find chargers along your route.
                </p>
              </div>
            ) : chargersOnRoute.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <MapPin className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-700 mb-1">No chargers within {corridorRadiusKm} km</p>
                <p className="text-[11px] text-slate-500 max-w-[220px]">
                  Try widening the corridor radius at the top to discover stations further off-path.
                </p>
              </div>
            ) : (
              chargersOnRoute.map((charger) => {
                const isSelected = selectedChargerId === charger._id;
                const power = charger.powerOutput || 7.4;
                const connector = charger.connectorType || 'Type 2';
                const price = charger.pricePerHour || 30;
                const locationAddress =
                  charger.location?.address || charger.address || charger.location?.city || 'Mysore';

                return (
                  <div
                    key={charger._id}
                    onClick={() => setSelectedChargerId(charger._id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-xs truncate">
                          {charger.title || charger.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {locationAddress}
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded shrink-0">
                        ₹{price}/hr
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">
                        {power} kW • {connector}
                      </span>
                      <Link
                        to={`/chargers/${charger._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        View Station
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Leaflet Map */}
        <div className="h-[580px] rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-slate-50">
          <Map
            chargers={chargersOnRoute}
            zoom={12}
            center={DEFAULT_CENTER}
            onMarkerClick={(chargerId) => setSelectedChargerId(chargerId)}
            selectedChargerId={selectedChargerId}
            routeCoords={routeCoords}
            startLocation={startLocation}
            endLocation={endLocation}
            corridorRadiusKm={corridorRadiusKm}
          />
        </div>
      </div>
    </div>
  );
};

export default PlanRoute;
