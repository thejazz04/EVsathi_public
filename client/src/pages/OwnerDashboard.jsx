import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { chargerService } from '../services/chargerService.js';
import { bookingService } from '../services/bookingService.js';
import { mlService } from '../services/mlService.js';
import {
  Building2,
  TrendingUp,
  Zap,
  PlusCircle,
  Calendar,
  DollarSign,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Activity,
  Car,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import CurrentDemandPredictionCard from '../components/ai/CurrentDemandPredictionCard.jsx';
import Demand24HourChart from '../components/ai/Demand24HourChart.jsx';

const OwnerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chargers, setChargers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predictionData, setPredictionData] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  useEffect(() => {
    const fetchOwnerData = async () => {
      setLoading(true);
      try {
        const [chargersRes, bookingsRes] = await Promise.allSettled([
          chargerService.getMyChargers(),
          bookingService.getMyBookings({ type: 'rentals' }),
        ]);

        let firstChargerId = null;
        if (chargersRes.status === 'fulfilled') {
          const list = chargersRes.value.data?.chargers || chargersRes.value.data || [];
          const validChargers = Array.isArray(list) ? list : [];
          setChargers(validChargers);
          if (validChargers.length > 0) {
            firstChargerId = validChargers[0]._id;
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
        console.error('Error fetching owner dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOwnerData();
  }, []);

  const fetchDemandPrediction = async (chargerId) => {
    setPredictionLoading(true);
    try {
      const res = await mlService.getDemandPrediction({
        chargerId,
        timestamp: new Date().toISOString(),
      });
      if (res.success && res.data) {
        setPredictionData(res.data);
      }
    } catch (err) {
      console.warn('Failed to load owner demand prediction:', err);
    } finally {
      setPredictionLoading(false);
    }
  };

  const activeChargersCount = chargers.filter((c) => c.isAvailable !== false).length;
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const totalEarnings = completedBookings.reduce((acc, b) => acc + (b.totalPrice || 0), 0);
  const upcomingReservations = bookings.filter((b) => ['confirmed', 'pending', 'active', 'in_progress'].includes(b.status));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-evsathi-mint/40 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-evsathi-soft text-evsathi-dark text-xs font-bold border border-evsathi-mint mb-2">
            <Building2 className="w-3.5 h-3.5 text-evsathi-teal" />
            <span>Host Station Control Panel</span>
          </div>
          <h1 className="text-3xl font-extrabold text-evsathi-dark tracking-tight">
            Host Dashboard
          </h1>
          <p className="text-sm text-evsathi-slate mt-1">
            Monitor station performance, manage available charging slots, and review driver bookings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/create-charger">
            <Button variant="primary" icon={PlusCircle}>
              List New Charger
            </Button>
          </Link>
          <Link to="/my-chargers">
            <Button variant="secondary" icon={Sliders}>
              Manage Slots
            </Button>
          </Link>
        </div>
      </div>

      {/* Financial & Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="bg-gradient-to-br from-evsathi-teal to-[#547b71] text-white p-6 shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">Total Realized Revenue</p>
              <h3 className="text-3xl font-extrabold mt-1">₹{totalEarnings}</h3>
            </div>
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-xs opacity-90 mt-4">
            From {completedBookings.length} completed sessions
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-evsathi-muted uppercase tracking-wider">Active Host Stations</p>
              <h3 className="text-3xl font-extrabold text-evsathi-dark mt-1">
                {activeChargersCount} / {chargers.length}
              </h3>
            </div>
            <div className="p-3 bg-evsathi-soft/60 rounded-2xl text-evsathi-teal">
              <Zap className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-evsathi-slate mt-4">Operational P2P Chargers</p>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-evsathi-muted uppercase tracking-wider">Upcoming Reservations</p>
              <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{upcomingReservations.length}</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-evsathi-slate mt-4">Driver Slot Reservations</p>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-evsathi-muted uppercase tracking-wider">Completed Charges</p>
              <h3 className="text-3xl font-extrabold text-evsathi-dark mt-1">{completedBookings.length}</h3>
            </div>
            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-evsathi-slate mt-4">Successfully Finished Sessions</p>
        </Card>
      </div>

      {/* Main Content Grid: Host Chargers & Smart Demand Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Columns: Station Portfolio & Bookings */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-evsathi-dark">My Host Chargers</h2>
                <p className="text-xs text-evsathi-slate">Manage status, hourly rates, and time slots</p>
              </div>
              <Link to="/my-chargers" className="text-xs font-bold text-evsathi-teal hover:underline">
                Manage All ({chargers.length})
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4">
                <Skeleton variant="card" className="h-28" />
                <Skeleton variant="card" className="h-28" />
              </div>
            ) : chargers.length > 0 ? (
              <div className="space-y-4">
                {chargers.map((charger) => (
                  <Card key={charger._id} className="p-6 border border-evsathi-mint/40 hover:border-evsathi-teal transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-evsathi-dark">
                            {charger.title || charger.name || 'P2P Home Station'}
                          </h4>
                          <Badge variant={charger.isAvailable !== false ? 'success' : 'neutral'} size="sm" dot>
                            {charger.isAvailable !== false ? 'Active' : 'Offline'}
                          </Badge>
                        </div>

                        <p className="text-xs text-evsathi-slate">
                          {charger.address || charger.location?.address || 'Residential Host'} • {charger.location?.city || charger.city || 'Mysore'}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-evsathi-muted pt-1">
                          <span>{charger.powerOutput || 7.4} kW</span>
                          <span>•</span>
                          <span>{charger.connectorType || 'Type 2 AC'}</span>
                          <span>•</span>
                          <span className="font-bold text-emerald-700">₹{charger.pricePerHour || 25}/hr</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link to={`/chargers/${charger._id}/edit-slots`}>
                          <Button variant="secondary" size="sm">
                            Edit Slots
                          </Button>
                        </Link>
                        <Link to={`/chargers/${charger._id}/timeline`}>
                          <Button variant="outline" size="sm">
                            Timeline
                          </Button>
                        </Link>
                        <Link to={`/chargers/${charger._id}`}>
                          <Button variant="outline" size="sm" icon={ChevronRight} iconPosition="right">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 border-dashed border-2 border-evsathi-mint">
                <div className="w-12 h-12 rounded-2xl bg-evsathi-light text-evsathi-teal flex items-center justify-center mx-auto mb-3">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-evsathi-dark">No chargers listed yet</h3>
                <p className="text-xs text-evsathi-slate max-w-sm mx-auto mt-1 mb-4">
                  List your home or business charger to start earning passive income when idle.
                </p>
                <Link to="/create-charger">
                  <Button variant="primary">Add Your First Charger</Button>
                </Link>
              </Card>
            )}
          </div>

          {/* Recent Booking Activity */}
          <Card className="p-6 space-y-4 border border-evsathi-mint/40">
            <div className="flex items-center justify-between border-b border-evsathi-soft/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-evsathi-dark">Recent Booking Activity</h3>
                <p className="text-xs text-evsathi-slate">Driver reservations for your chargers</p>
              </div>
              <Link to="/my-chargers" className="text-xs font-bold text-evsathi-teal hover:underline">
                View All
              </Link>
            </div>

            {bookings.length > 0 ? (
              <div className="divide-y divide-evsathi-soft/60">
                {bookings.slice(0, 4).map((b) => (
                  <div key={b._id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <p className="font-bold text-evsathi-dark">
                        {b.charger?.title || 'Host Station'}
                      </p>
                      <p className="text-evsathi-muted text-[11px] mt-0.5">
                        {new Date(b.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-700">₹{b.totalPrice}</span>
                      <Badge variant={b.status === 'completed' ? 'success' : 'primary'} size="sm">
                        {b.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No recent booking activity.</p>
            )}
          </Card>
        </div>

        {/* Right 5 Columns: Smart Pricing & Demand Insights */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-evsathi-teal uppercase tracking-wider">
              Smart Pricing & Demand Insights
            </span>
            <h3 className="text-lg font-extrabold text-evsathi-dark">
              Station Demand & Utilization
            </h3>
            <p className="text-xs text-evsathi-slate">
              Demand intelligence optimizes host revenue during peak hours while keeping off-peak slots attractive to EV drivers.
            </p>
          </div>

          <CurrentDemandPredictionCard
            predictionData={predictionData}
            loading={predictionLoading}
            stationLabel={chargers[0]?.title}
          />

          {/* 24-Hour Demand Chart for First Charger */}
          {chargers.length > 0 && (
            <Demand24HourChart 
              chargerId={chargers[0]._id}
              stationName={chargers[0]?.title}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
