import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chargerService } from '../services/chargerService.js';
import Map from '../components/Map.jsx';
import ChargerCard from '../components/ChargerCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import SmartScoreBadge from '../components/ai/SmartScoreBadge.jsx';
import { ChargerCardSkeleton } from '../components/ui/Skeleton.jsx';
import { MapPin, Sparkles, Filter, SlidersHorizontal, ArrowUpDown, Search } from 'lucide-react';

const POPULAR_LOCATIONS = [
  'Mysore',
  'Srirangapatna',
  'Mysore Palace',
  'Chamundi Hills',
  'KRS Dam',
  'Brindavan Gardens',
  'Infosys Mysore',
];

const ChargerList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChargerId, setSelectedChargerId] = useState(null);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'list', 'map'
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [sortOption, setSortOption] = useState('recommended');

  const [filters, setFilters] = useState({
    connectorType: searchParams.get('connectorType') || '',
    chargerType: searchParams.get('chargerType') || '',
    search: searchParams.get('search') || '',
    minPower: searchParams.get('minPower') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    availableOnly: false,
  });

  // Sync search input if URL search parameter changes
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== filters.search) {
      setFilters((prev) => ({ ...prev, search: q }));
    }
  }, [searchParams]);

  // Handle clicking outside of dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = (location) => {
    setFilters((prev) => ({ ...prev, search: location }));
    setShowDropdown(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (location) next.set('search', location);
      else next.delete('search');
      return next;
    });
  };

  const filteredLocations = POPULAR_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes((filters.search || '').toLowerCase().trim())
  );

  const fetchChargers = async () => {
    setLoading(true);
    try {
      const activeFilters = {};
      if (filters.connectorType) activeFilters.connectorType = filters.connectorType;
      if (filters.chargerType) activeFilters.chargerType = filters.chargerType;
      if (filters.search) activeFilters.search = filters.search;
      if (filters.minPower) activeFilters.minPower = filters.minPower;
      if (filters.maxPrice) activeFilters.maxPrice = filters.maxPrice;

      const res = await chargerService.getChargers(activeFilters);
      const list = res.data?.chargers || res.data || [];
      
      let processed = Array.isArray(list) ? list : [];

      if (filters.availableOnly) {
        processed = processed.filter(c => c.isAvailable !== false && c.isActive !== false);
      }

      // Genuine sorting
      if (sortOption === 'price_asc') {
        processed.sort((a, b) => (a.pricePerHour || 0) - (b.pricePerHour || 0));
      } else if (sortOption === 'price_desc') {
        processed.sort((a, b) => (b.pricePerHour || 0) - (a.pricePerHour || 0));
      } else if (sortOption === 'power_desc') {
        processed.sort((a, b) => (b.powerOutput || 0) - (a.powerOutput || 0));
      } else if (sortOption === 'availability') {
        processed.sort((a, b) => (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0));
      }

      setChargers(processed);
    } catch (err) {
      console.error('Error fetching chargers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChargers();
  }, [filters, sortOption]);

  const mapCenter = chargers.length > 0 && chargers[0].location?.coordinates
    ? [chargers[0].location.coordinates[1], chargers[0].location.coordinates[0]]
    : [23.0225, 72.5714];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header & Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-evsathi-mint/40 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-evsathi-dark tracking-tight">
            Find the Smartest Charge
          </h1>
          <p className="text-xs text-evsathi-slate mt-0.5">
            Filter chargers by Smart Score, lowest price, availability, and low-demand off-peak windows.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-3">
          <div className="bg-evsathi-surface p-1 rounded-xl flex items-center border border-evsathi-soft text-xs font-semibold">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded-lg transition-colors hidden sm:block ${
                viewMode === 'split' ? 'bg-white text-evsathi-dark font-extrabold shadow-xs' : 'text-evsathi-slate'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-white text-evsathi-dark font-extrabold shadow-xs' : 'text-evsathi-slate'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                viewMode === 'map' ? 'bg-white text-evsathi-dark font-extrabold shadow-xs' : 'text-evsathi-slate'
              }`}
            >
              Map View
            </button>
          </div>
        </div>
      </div>

      {/* Inline Quick Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-evsathi-mint/60 shadow-xs relative z-30">
        <div className="relative flex-1 max-w-md" ref={dropdownRef}>
          <Search className="w-4 h-4 text-evsathi-teal absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search location (e.g. Mysore Palace, Chamundi Hills)..."
            value={filters.search}
            onFocus={() => setShowDropdown(true)}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, search: e.target.value }));
              setShowDropdown(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setShowDropdown(false);
            }}
            className="w-full pl-10 pr-8 py-2.5 bg-white border border-evsathi-mint/80 rounded-xl text-xs sm:text-sm text-evsathi-dark font-medium placeholder-evsathi-muted focus:outline-none focus:ring-2 focus:ring-evsathi-teal focus:border-evsathi-teal shadow-2xs transition"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({ ...prev, search: '' }));
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('search');
                  return next;
                });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-evsathi-muted hover:text-evsathi-dark p-0.5 rounded text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}

          {/* Suggestions Dropdown: Overlays cleanly with proper z-index and rounded corners */}
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-evsathi-mint/80 py-2 z-50 max-h-60 overflow-y-auto">
              <p className="px-3.5 py-1 text-[11px] font-bold text-evsathi-muted uppercase tracking-wider">
                Suggested Locations
              </p>
              {(filteredLocations.length > 0 ? filteredLocations : POPULAR_LOCATIONS).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectLocation(loc);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs sm:text-sm text-evsathi-dark hover:bg-evsathi-surface hover:text-evsathi-teal flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-evsathi-teal shrink-0" />
                  <span className="font-medium">{loc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilters(prev => ({ ...prev, availableOnly: !prev.availableOnly }))}
            className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
              filters.availableOnly
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            Available Now
          </button>

          <button
            type="button"
            onClick={() => setFilters(prev => ({ ...prev, minPower: prev.minPower === '25' ? '' : '25' }))}
            className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
              filters.minPower === '25'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            Fast DC (≥25kW)
          </button>

          <button
            type="button"
            onClick={() => setFilters(prev => ({ ...prev, connectorType: prev.connectorType === 'CCS2' ? '' : 'CCS2' }))}
            className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
              filters.connectorType === 'CCS2'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            CCS2
          </button>

          <button
            type="button"
            onClick={() => setFilters(prev => ({ ...prev, connectorType: prev.connectorType === 'Type 2' ? '' : 'Type 2' }))}
            className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
              filters.connectorType === 'Type 2'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            Type 2
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="recommended">Recommended</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="power_desc">Fastest Charging</option>
              <option value="availability">Availability</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced Filter Modal Popup - Only shown when showFilterModal === true */}
      {showFilterModal && (
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          onClose={() => setShowFilterModal(false)}
        />
      )}

      {/* Discovery Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        
        {/* Left Column: Charger Cards List */}
        {viewMode !== 'map' && (
          <div className={`${viewMode === 'list' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4 overflow-y-auto max-h-[750px] pr-1`}>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span>Marketplace Stations ({chargers.length})</span>
              <span className="text-[11px] text-slate-400">Live inventory</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ChargerCardSkeleton />
                <ChargerCardSkeleton />
              </div>
            ) : chargers.length === 0 ? (
              <EmptyState
                title="No Stations Found"
                description="No charging stations match your selected filters. Try broadening your criteria."
                actionText="Reset Filters"
                onAction={() =>
                  setFilters({ connectorType: '', chargerType: '', search: '', minPower: '', maxPrice: '', availableOnly: false })
                }
              />
            ) : (
              <div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {chargers.map((charger) => (
                  <div
                    key={charger._id}
                    onMouseEnter={() => setSelectedChargerId(charger._id)}
                    onMouseLeave={() => setSelectedChargerId(null)}
                    className="relative"
                  >
                    <ChargerCard charger={charger} isSelected={selectedChargerId === charger._id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Column: Leaflet Map Component */}
        {viewMode !== 'list' && (
          <div className={`${viewMode === 'map' ? 'lg:col-span-12' : 'lg:col-span-6'} h-[600px] lg:h-[750px] sticky top-20`}>
            <Map
              chargers={chargers}
              center={mapCenter}
              zoom={12}
              selectedChargerId={selectedChargerId}
              onMarkerClick={(id) => setSelectedChargerId(id)}
              showHeatmap={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChargerList;
