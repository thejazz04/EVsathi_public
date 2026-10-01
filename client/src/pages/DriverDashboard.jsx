import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { chargerService } from '../services/chargerService.js';
import { bookingService } from '../services/bookingService.js';
import { mlService } from '../services/mlService.js';
import {
  MapPin,
  Search,
  Wallet,
  Calendar,
  Zap,
  ArrowRight,
  Clock,
  ChevronRight,
  Navigation,
  MessageSquare,
  User,
  History,
  Star,
  CheckCircle2,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import CurrentDemandPredictionCard from '../components/ai/CurrentDemandPredictionCard.jsx';

const DriverDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chargers, setChargers] = useState([]);
  const [selectedChargerId, setSelectedChargerId] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predictionData, setPredictionData] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [chargersRes, bookingsRes] = await Promise.allSettled([
          chargerService.getChargers({ limit: 10 }),
          bookingService.getMyBookings(),
        ]);

        let firstChargerId = null;
        if (chargersRes.status === 'fulfilled') {
          const list = chargersRes.value.data?.chargers || chargersRes.value.data || [];
          const legitimateChargers = Array.isArray(list)
            ? list
                .filter(
                  (c) =>
                    !c.stationId?.startsWith('CHG-PHASE') &&
                    !c.stationId?.startsWith('CHG-NCR') &&
                    !c.title?.toLowerCase().includes('sample') &&
                    !c.name?.toLowerCase().includes('sample')
                )
                .slice(0, 6)
            : [];
          setChargers(legitimateChargers);

          if (legitimateChargers.length > 0) {
            firstChargerId = legitimateChargers[0]._id;
            setSelectedChargerId(firstChargerId);
          }
        }

        if (bookingsRes.status === 'fulfilled') {
          const list = bookingsRes.value.data?.bookings || bookingsRes.value.data || [];
          setBookings(Array.isArray(list) ? list : []);
        }

        if (firstChargerId) {
          fetchDemandPrediction(firstChargerId);
        }
      } catch (err) {
        console.error('Error loading driver dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchDemandPrediction = async (chargerId) => {
    if (!chargerId) return;
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const res = await mlService.getDemandPrediction({
        chargerId,
        timestamp: new Date().toISOString(),
      });
      if (res.success && res.data) {
        setPredictionData(res.data);
      } else {
        setPredictionError('Unable to load expected demand.');
      }
    } catch (err) {
      console.warn('Driver dashboard demand fetch failed:', err);
      setPredictionError('Demand service temporarily unavailable.');
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleSelectCharger = (chargerId) => {
    setSelectedChargerId(chargerId);
    fetchDemandPrediction(chargerId);
  };

  const activeBooking = bookings.find((b) => b.status === 'active' || b.status === 'in_progress');
  const upcomingBooking = bookings.find((b) => b.status === 'confirmed' || b.status === 'pending');
  const latestBooking = activeBooking || upcomingBooking || bookings[0];

  const quickTools = [
    { label: 'Find Chargers', path: '/chargers', icon: Search, desc: 'Search nearby stations' },
    { label: 'Plan Route', path: '/plan-route', icon: Navigation, desc: 'Route corridor charging' },
    { label: 'My Bookings', path: '/my-bookings', icon: Calendar, desc: 'Active & past reservations' },
    { label: 'Wallet', path: '/wallet', icon: Wallet, desc: 'Balance & top-up' },
    { label: 'Transaction History', path: '/wallet/history', icon: History, desc: 'Receipts & payment logs' },
    { label: 'Chat', path: '/chats', icon: MessageSquare, desc: 'Direct host messaging' },
    { label: 'Profile', path: '/profile', icon: User, desc: 'Vehicle & account settings' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* 1. Top Banner: Driver Greeting & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Driver'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Discover available chargers, manage your reserved slots, and optimize your charging schedule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/chargers">
            <Button variant="primary" size="sm" icon={Search}>
              Find a Charger
            </Button>
          </Link>
          <Link to="/wallet">
            <Button variant="secondary" size="sm" icon={Wallet}>
              Wallet: ₹{user?.walletBalance ?? 0}
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Driver Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Link to="/my-bookings" className="block">
          <Card className="p-3.5 bg-white border border-slate-200 hover:border-emerald-300 transition-all shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Upcoming / Active</p>
                <h3 className="text-xl font-extrabold text-emerald-600 mt-0.5">
                  {bookings.filter((b) => ['active', 'in_progress', 'confirmed', 'pending'].includes(b.status)).length}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">Reserved Charging Slots</p>
          </Card>
        </Link>

        <Link to="/my-bookings" className="block">
          <Card className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">My Bookings</p>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">{bookings.length}</h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">Total Charging Sessions</p>
          </Card>
        </Link>

        <Link to="/wallet" className="block">
          <Card className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Wallet Balance</p>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">₹{user?.walletBalance ?? 0}</h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">Available for Booking</p>
          </Card>
        </Link>

        <Link to="/plan-route" className="block">
          <Card className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Route Planner</p>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">On Route</h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Navigation className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">Corridor Station Discovery</p>
          </Card>
        </Link>
      </div>

      {/* 3. Main Grid: Recent Charging Activity + Expected Station Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left Column: Recent Charging Activity Card */}
        <div>
          <Card className="p-4 border border-slate-200 bg-white shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Reservations
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {activeBooking
                    ? 'Active Charging Session'
                    : upcomingBooking
                    ? 'Upcoming Reservation'
                    : 'Recent Charging Activity'}
                </h3>
              </div>
              <Link to="/my-bookings" className="text-xs font-bold text-emerald-600 hover:underline">
                View All ({bookings.length})
              </Link>
            </div>

            {loading ? (
              <Skeleton variant="card" className="h-24" />
            ) : latestBooking ? (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate flex-1 pr-2">
                    {latestBooking.charger?.title || latestBooking.charger?.name || 'EV Charger'}
                  </h4>
                  <Badge
                    variant={
                      latestBooking.status === 'active' || latestBooking.status === 'in_progress'
                        ? 'success'
                        : 'primary'
                    }
                    size="sm"
                  >
                    {latestBooking.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Start Time</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {new Date(latestBooking.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">End Time</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {new Date(latestBooking.endTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Price</span>
                    <span className="font-bold text-emerald-700 text-xs">₹{latestBooking.totalPrice}</span>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/60">
                  <Link to="/my-bookings">
                    <Button variant="secondary" size="sm">
                      Booking Details
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-slate-500 mb-3">No active or upcoming reservations found.</p>
                <Link to="/chargers">
                  <Button variant="primary" size="sm" icon={Search}>
                    Find a Charger
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Expected Station Demand */}
        <div>
          <CurrentDemandPredictionCard
            predictionData={predictionData}
            loading={predictionLoading}
            error={predictionError}
            chargers={chargers}
            selectedChargerId={selectedChargerId}
            onSelectCharger={handleSelectCharger}
          />
        </div>
      </div>

      {/* 4. Compact Quick Tools — Single Horizontal Row */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 pr-2 sm:border-r sm:border-slate-200 shrink-0">
            Quick Tools
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {quickTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.label}
                  to={tool.path}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 transition-colors shrink-0"
                >
                  <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="whitespace-nowrap">{tool.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Recommended Chargers — 3-Column Marketplace Layout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Recommended Chargers</h3>
            <p className="text-xs text-slate-500">Available marketplace chargers for slot booking</p>
          </div>
          <Link to="/chargers" className="text-xs font-bold text-emerald-600 hover:underline">
            Explore All ({chargers.length})
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <Skeleton variant="card" className="h-28" />
            <Skeleton variant="card" className="h-28" />
            <Skeleton variant="card" className="h-28" />
          </div>
        ) : chargers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {chargers.map((c) => {
              const isSelected = selectedChargerId === c._id;
              const hasRealRating = Number(c.rating) > 0 && Number(c.totalRatings || c.ratingCount || 0) > 0;
              const ratingVal = hasRealRating ? Number(c.rating).toFixed(1) : null;
              const totalRatings = c.totalRatings || c.ratingCount || 0;

              return (
                <Card
                  key={c._id}
                  className={`p-3.5 bg-white border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => handleSelectCharger(c._id)}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate flex-1">
                        {c.title || c.name || 'EV Charger'}
                      </h4>
                      {hasRealRating && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          {ratingVal} ({totalRatings})
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 truncate">
                      {c.location?.address || c.address || 'Mysore'}
                    </p>

                    <div className="text-[11px] text-slate-600 font-medium flex items-center gap-2 pt-1 border-t border-slate-100">
                      <span>{c.powerOutput || 7.4} kW</span>
                      <span>•</span>
                      <span>{c.connectorType || 'Type 2'}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">₹{c.pricePerHour || 25}/hr</span>
                    </div>
                  </div>

                  <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-end">
                    <Link to={`/chargers/${c._id}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="sm" icon={ChevronRight} iconPosition="right">
                        View &amp; Book
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-5 text-center text-xs text-slate-500">
            No chargers currently available in your area.
          </Card>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
