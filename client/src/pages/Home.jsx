import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { chargerService } from '../services/chargerService.js';
import {
  Zap,
  Search,
  MapPin,
  PlusCircle,
  TrendingDown,
  Clock,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

const POPULAR_LOCATIONS = [
  'Mysore',
  'Srirangapatna',
  'Mysore Palace',
  'Chamundi Hills',
  'KRS Dam',
  'Brindavan Gardens',
  'Infosys Mysore',
];

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [featuredChargers, setFeaturedChargers] = useState([]);
  const [loadingChargers, setLoadingChargers] = useState(true);
  const dropdownRef = useRef(null);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const userRole = (user?.role || '').toLowerCase();
  const isHost = ['owner', 'host', 'both'].includes(userRole);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await chargerService.getChargers({ limit: 4 });
        const list = res.data?.chargers || res.data || [];
        setFeaturedChargers(Array.isArray(list) ? list.slice(0, 4) : []);
      } catch (err) {
        console.warn('Could not load featured chargers for homepage:', err);
      } finally {
        setLoadingChargers(false);
      }
    };

    fetchFeatured();
  }, []);

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
    setSearchQuery(location);
    setShowDropdown(false);
    navigate(`/chargers?search=${encodeURIComponent(location)}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setShowDropdown(false);
    if (searchQuery.trim()) {
      navigate(`/chargers?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/chargers');
    }
  };

  const getListChargerLink = () => {
    if (!isAuthenticated) return '/register';
    if (isHost) return '/create-charger';
    return '/owner/dashboard';
  };

  const filteredLocations = POPULAR_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="space-y-12 py-4">

      {/* 1. HERO SECTION: CLEAN, MINIMAL P2P MARKETPLACE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-white via-evsathi-surface to-evsathi-light rounded-3xl border border-evsathi-mint/60 p-8 sm:p-12 shadow-sm relative overflow-visible z-10">
          <div className="max-w-2xl space-y-5">


            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-evsathi-teal">
                P2P EV Charger-Sharing Marketplace
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-evsathi-dark tracking-tight leading-tight">
                Share Your Charger. <br />
                <span className="text-evsathi-teal">Charge Anywhere.</span>
              </h1>
            </div>

            <p className="text-sm sm:text-base text-evsathi-slate leading-relaxed">
              Connect with private home and business charger hosts across your city. Reserve charging slots in advance and save with smart, demand-aware pricing.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link to="/chargers">
                <Button variant="primary" size="md" icon={Search}>
                  Find a Charger
                </Button>
              </Link>
              <Link to={getListChargerLink()}>
                <Button variant="secondary" size="md" icon={PlusCircle} className="border border-evsathi-mint">
                  List Your Charger
                </Button>
              </Link>
            </div>

            {/* Search with Autocomplete Dropdown */}
            <div className="relative pt-2 max-w-xl">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full" ref={dropdownRef}>
                  <MapPin className="w-4 h-4 text-evsathi-teal absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search location (e.g. Mysore Palace, Chamundi Hills)..."
                    value={searchQuery}
                    onFocus={() => setShowDropdown(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    className="w-full pl-10 pr-3 py-2.5 bg-white rounded-xl border border-evsathi-mint/80 text-sm text-evsathi-dark placeholder-evsathi-muted focus:outline-none focus:ring-2 focus:ring-evsathi-teal shadow-xs"
                  />

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
                          className="w-full text-left px-3.5 py-2 text-sm text-evsathi-dark hover:bg-evsathi-surface hover:text-evsathi-teal flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-evsathi-teal shrink-0" />
                          <span className="font-medium">{loc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button type="submit" variant="primary" size="md" className="w-full sm:w-auto shrink-0">
                  Search
                </Button>
              </form>

              {/* Quick Search Tags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs">
                <span className="text-evsathi-muted font-medium">Popular:</span>
                {['Mysore', 'Mysore Palace', 'Chamundi Hills', 'Brindavan Gardens'].map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleSelectLocation(loc)}
                    className="px-2 py-0.5 rounded-md bg-white hover:bg-evsathi-soft text-evsathi-slate hover:text-evsathi-teal border border-evsathi-mint/60 transition-colors text-[11px]"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. REAL CHARGER MARKETPLACE: FEATURED HOST CHARGERS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-evsathi-dark">
              Featured Host Chargers
            </h2>
            <p className="text-xs sm:text-sm text-evsathi-slate mt-0.5">
              Available charging stations ready for slot booking.
            </p>
          </div>
          <Link to="/chargers">
            <Button variant="outline" size="sm" icon={ChevronRight} iconPosition="right">
              View All Chargers
            </Button>
          </Link>
        </div>

        {loadingChargers ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton variant="card" className="h-56" />
            <Skeleton variant="card" className="h-56" />
            <Skeleton variant="card" className="h-56" />
            <Skeleton variant="card" className="h-56" />
          </div>
        ) : featuredChargers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredChargers.map((charger) => (
              <Card
                key={charger._id}
                className="p-4 bg-white border border-evsathi-mint/50 hover:border-evsathi-teal hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant={charger.isAvailable !== false ? 'success' : 'neutral'} size="sm" dot>
                      {charger.isAvailable !== false ? 'Available' : 'Reserved'}
                    </Badge>
                    <span className="text-[11px] font-semibold text-evsathi-teal bg-evsathi-light px-2 py-0.5 rounded">
                      {charger.hostType || 'Host Station'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-evsathi-dark line-clamp-1">
                      {charger.title || charger.name || 'EV Charger'}
                    </h3>
                    <p className="text-xs text-evsathi-slate flex items-center gap-1 mt-0.5 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-evsathi-teal shrink-0" />
                      <span>{charger.location?.city || charger.city || 'Mysore'}</span>
                      <span className="text-slate-400">•</span>
                      <span className="truncate">{charger.location?.address || charger.address || 'Local Station'}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2 bg-evsathi-surface rounded-lg text-[11px] font-semibold text-evsathi-slate">
                    <div>
                      <span className="text-evsathi-muted block text-[10px]">Power</span>
                      <span className="font-bold text-evsathi-dark">{charger.powerOutput || 7.4} kW</span>
                    </div>
                    <div>
                      <span className="text-evsathi-muted block text-[10px]">Plug</span>
                      <span className="font-bold text-evsathi-dark">{charger.connectorType || 'Type 2 AC'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-evsathi-soft/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-evsathi-muted block font-semibold">Rate</span>
                    <span className="text-base font-extrabold text-emerald-700">₹{charger.pricePerHour || 25}<span className="text-xs font-normal text-evsathi-muted">/hr</span></span>
                  </div>
                  <Link to={`/chargers/${charger._id}`}>
                    <Button variant="primary" size="sm">
                      View & Book
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-xs text-evsathi-slate">
            Chargers are being updated. Click &quot;View All Chargers&quot; to browse all listings.
          </Card>
        )}
      </section>

      {/* 3. MINIMAL SMART CHARGING FEATURES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-white border border-evsathi-mint/40 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-evsathi-soft text-evsathi-teal flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-evsathi-dark">Charging Demand Insights</h3>
            <p className="text-xs text-evsathi-slate leading-relaxed">
              See expected charging demand before you book to choose the least crowded charging window.
            </p>
          </Card>

          <Card className="p-5 bg-white border border-evsathi-mint/40 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-evsathi-soft text-evsathi-teal flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-evsathi-dark">Smart Pricing</h3>
            <p className="text-xs text-evsathi-slate leading-relaxed">
              Pricing adapts smoothly to charging demand and charger conditions.
            </p>
          </Card>

          <Card className="p-5 bg-white border border-evsathi-mint/40 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-evsathi-soft text-evsathi-teal flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-evsathi-dark">Guaranteed Slot Booking</h3>
            <p className="text-xs text-evsathi-slate leading-relaxed">
              Pre-book your exact charging time slot with concurrency protection against double-booking.
            </p>
          </Card>
        </div>
      </section>

      {/* 4. CLEAN CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pb-4">
        <div className="bg-gradient-to-r from-evsathi-teal to-[#547b71] text-white rounded-2xl p-8 shadow-md space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ready to Join the EVsathi Network?
          </h2>
          <p className="text-xs sm:text-sm text-evsathi-light max-w-md mx-auto leading-relaxed">
            Discover community chargers nearby or list your own charger today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link to="/chargers">
              <Button variant="dark" size="md" icon={Search}>
                Find a Charger
              </Button>
            </Link>
            <Link to={getListChargerLink()}>
              <Button variant="secondary" size="md" icon={PlusCircle}>
                List Your Charger
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
