import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { chargerService } from '../services/chargerService.js';
import { slotService } from '../services/slotService.js';
import { bookingService } from '../services/bookingService.js';
import { pricingService } from '../services/pricingService.js';
import { mlService } from '../services/mlService.js';
import { reviewService } from '../services/reviewService.js';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Zap,
  MapPin,
  Clock,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  Calendar,
  DollarSign,
  Info,
  CheckCircle2,
  ChevronLeft,
  Activity,
  Star,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Toast from '../components/ui/Toast.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import Demand24HourChart from '../components/ai/Demand24HourChart.jsx';

const formatTime = (dateString, slotTimezone) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: slotTimezone || 'UTC',
  });
};

export const getDemandState = (val) => {
  if (val == null || typeof val !== 'number' || Number.isNaN(val)) {
    return null;
  }
  const num = val;
  if (num < 0.30) {
    return {
      label: 'LOW',
      percent: Math.round(num * 100),
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      barColor: 'bg-emerald-500',
      description: 'This station is currently experiencing low demand. Ideal time to charge at lower rates.',
    };
  } else if (num < 0.65) {
    return {
      label: 'MODERATE',
      percent: Math.round(num * 100),
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      barColor: 'bg-blue-500',
      description: 'Typical charging activity and steady turnaround at this station.',
    };
  } else if (num < 0.85) {
    return {
      label: 'HIGH',
      percent: Math.round(num * 100),
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      barColor: 'bg-amber-500',
      description: 'This station is currently experiencing higher charging demand.',
    };
  } else {
    return {
      label: 'VERY HIGH',
      percent: Math.round(num * 100),
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      barColor: 'bg-rose-500',
      description: 'Peak rush period. High demand and high occupancy at this location.',
    };
  }
};

const ChargerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();

  const [charger, setCharger] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotTimezone, setSlotTimezone] = useState('');
  const [pricingInfo, setPricingInfo] = useState(null);
  const [demandInfo, setDemandInfo] = useState(null);
  const [slotDemandCache, setSlotDemandCache] = useState({}); // Cache ML predictions by hour
  const [selectedDuration, setSelectedDuration] = useState(null); // Filter slots by duration
  const [ml24HourData, setMl24HourData] = useState(null); // Store 24-hour ML predictions
  const [ganttBookings, setGanttBookings] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  // Flexible booking state - MUST be declared before any code that uses it
  const [customBooking, setCustomBooking] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    duration: 0,
    estimatedCost: 0
  });

  // ===== SINGLE SOURCE OF TRUTH FOR PRICING =====
  // This function is used by EVERYTHING: graph, slots, insights card
  const calculateHourlyPrice = (hour, demandCache = slotDemandCache) => {
    const basePriceValue = charger?.pricing?.basePrice || basePrice;
    
    // Get ML demand prediction for this hour
    let demandValue = demandCache[hour];
    
    // Fallback if no ML data (should rarely happen after cache loads)
    if (demandValue == null) {
      console.warn(`⚠️ No ML data for hour ${hour}, using fallback`);
      if (hour >= 6 && hour < 9) demandValue = 0.75;
      else if (hour >= 9 && hour < 12) demandValue = 0.5;
      else if (hour >= 12 && hour < 14) demandValue = 0.65;
      else if (hour >= 14 && hour < 17) demandValue = 0.4;
      else if (hour >= 17 && hour < 20) demandValue = 0.85;
      else if (hour >= 20 && hour < 23) demandValue = 0.55;
      else demandValue = 0.2;
    }
    
    // Calculate price with surge
    const demandPercent = Math.round(demandValue * 100);
    const surgeFactor = 1 + (demandPercent / 100) * 0.5; // 0-50% surge
    const hourPrice = Math.ceil(basePriceValue * surgeFactor);
    
    return { price: hourPrice, demandValue, demandPercent };
  };

  // Fetch all 24-hour ML predictions once
  useEffect(() => {
    const fetch24HourPredictions = async () => {
      if (!id) return;
      
      try {
        const targetDate = customBooking.date || new Date().toISOString().split('T')[0];
        console.log(`🔄 Fetching 24-hour ML predictions for charger ${id}, date: ${targetDate}`);
        
        const res = await api.get(`/ml/demand/${id}/24hour`, {
          params: { date: targetDate },
          timeout: 30000
        });
        
        const predictions = res.data?.data?.predictions || [];
        console.log(`✅ Received ${predictions.length} hourly predictions:`, predictions);
        
        // Convert to hour-indexed cache for easy lookup
        const cache = {};
        predictions.forEach(pred => {
          if (pred.hour != null && pred.demandValue != null) {
            // Convert UTC hour to IST hour
            const istHour = (pred.hour + 5.5) % 24;
            const istHourInt = Math.floor(istHour);
            cache[istHourInt] = pred.demandValue;
          }
        });
        
        console.log(`📊 IST Hour Cache populated:`, cache);
        setMl24HourData(predictions);
        setSlotDemandCache(cache);
      } catch (error) {
        console.error('❌ Error fetching 24-hour predictions:', error);
      }
    };
    
    fetch24HourPredictions();
  }, [id, customBooking.date]);

  // Fetch ML demand prediction for a specific hour
  const fetchSlotDemand = async (startTime) => {
    if (!startTime || !id) return null;
    
    try {
      const timestamp = new Date(`${customBooking.date}T${startTime}`).toISOString();
      const hour = new Date(timestamp).getHours();
      
      // Check cache first
      if (slotDemandCache[hour]) {
        return slotDemandCache[hour];
      }
      
      // Fetch from ML API
      const res = await mlService.getDemandPrediction({ 
        chargerId: id, 
        timestamp 
      });
      
      const demandValue = res.data?.demandValue;
      if (demandValue != null) {
        // Cache the result
        setSlotDemandCache(prev => ({ ...prev, [hour]: demandValue }));
        return demandValue;
      }
      
      // Fallback to rule-based if ML fails
      return null;
    } catch (error) {
      console.error('Error fetching slot demand:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchDetailData = async () => {
      setLoading(true);
      try {
        const [chargerRes, gridRes, priceRes, demandRes, reviewsRes] = await Promise.allSettled([
          chargerService.getCharger(id),
          slotService.getGrid(id, { days: 1 }),
          pricingService.getPricingInfo(id),
          mlService.getDemandPrediction({ chargerId: id, timestamp: new Date().toISOString() }),
          reviewService.getByCharger(id),
        ]);

        if (chargerRes.status === 'fulfilled') {
          setCharger(chargerRes.value.data?.charger || chargerRes.value.data);
        }

        if (gridRes.status === 'fulfilled') {
          const gridData = gridRes.value.data;
          setSlots(gridData?.slots || gridData?.data?.slots || []);
          setSlotTimezone(gridData?.timezone || 'UTC');
        }

        if (priceRes.status === 'fulfilled') {
          setPricingInfo(priceRes.value.data);
        }

        if (demandRes.status === 'fulfilled' && demandRes.value?.data) {
          setDemandInfo(demandRes.value.data);
        }

        if (reviewsRes.status === 'fulfilled' && reviewsRes.value?.data?.reviews) {
          setReviews(reviewsRes.value.data.reviews);
        }
        
        // Fetch bookings for Gantt chart
        fetchGanttBookings();
      } catch (err) {
        console.error('Error loading charger details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetailData();
  }, [id]);

  const fetchReviews = async () => {
    try {
      const res = await reviewService.getByCharger(id);
      if (res?.data?.reviews) {
        setReviews(res.data.reviews);
      }
    } catch (err) {
      console.warn('Failed to load reviews:', err);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    setReviewSuccess('');
    try {
      const res = await reviewService.create({
        chargerId: id,
        rating: reviewRating,
        comment: reviewComment,
      });
      if (res.success) {
        setReviewSuccess('Thank you! Your review has been submitted.');
        setReviewComment('');
        setShowReviewForm(false);
        await fetchReviews();
        // Refresh charger details for updated rating and count
        const updated = await chargerService.getCharger(id);
        if (updated?.data?.charger || updated?.data) {
          setCharger(updated.data?.charger || updated.data);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to submit review.';
      setReviewError(msg);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const fetchGanttBookings = async () => {
    try {
      // Only fetch if user is authenticated
      if (!isAuthenticated) {
        setGanttBookings([]);
        return;
      }
      
      const res = await api.get(`/bookings?chargerId=${id}`);
      const allBookings = res.data?.data?.bookings || res.data?.bookings || [];
      setGanttBookings(allBookings);
    } catch (error) {
      console.log('Could not fetch bookings for Gantt chart:', error);
      setGanttBookings([]); // Set empty array on error
    }
  };

  // Calculate weighted average dynamic price for a time slot spanning multiple hours
  const calculateSlotAveragePrice = (startTime, endTime) => {
    const start = new Date(`${customBooking.date}T${startTime}`);
    const end = new Date(`${customBooking.date}T${endTime}`);
    
    if (end <= start) return currentPpoPrice;
    
    const durationMs = end - start;
    
    // Calculate price for each hour in the slot
    let totalWeightedPrice = 0;
    let currentHourStart = new Date(start);
    const hourPrices = []; // For debugging
    
    while (currentHourStart < end) {
      const hour = currentHourStart.getHours();
      const nextHourStart = new Date(currentHourStart);
      nextHourStart.setHours(hour + 1, 0, 0, 0);
      
      // Calculate how much of this hour is in the slot
      const hourEnd = nextHourStart > end ? end : nextHourStart;
      const hourDurationMs = hourEnd - (currentHourStart > start ? currentHourStart : start);
      const hourWeight = hourDurationMs / durationMs; // Fraction of total duration
      
      // Use SINGLE SOURCE OF TRUTH
      const { price: hourPrice, demandPercent } = calculateHourlyPrice(hour);
      
      hourPrices.push({ hour, demandPercent, hourPrice, weight: hourWeight.toFixed(2) });
      
      // Add weighted contribution
      totalWeightedPrice += hourPrice * hourWeight;
      
      currentHourStart = nextHourStart;
    }
    
    const finalPrice = Math.ceil(totalWeightedPrice);
    console.log(`💰 Slot ${startTime}-${endTime}: Weighted avg = ₹${finalPrice}/hr`, hourPrices);
    
    return finalPrice;
  };

  // Calculate dynamic price based on ML demand prediction for selected time slot
  const calculateDynamicPrice = (startTime, endTime) => {
    if (!startTime) return currentPpoPrice;
    if (!endTime) endTime = startTime; // Single hour
    
    return calculateSlotAveragePrice(startTime, endTime);
  };

  // Fetch ML prediction when user selects a slot - fetch ALL hours in the slot
  useEffect(() => {
    if (customBooking.startTime && customBooking.endTime) {
      const start = new Date(`${customBooking.date}T${customBooking.startTime}`);
      const end = new Date(`${customBooking.date}T${customBooking.endTime}`);
      
      // Fetch ML predictions for all hours in the selected slot
      let currentHour = start.getHours();
      const endHour = end.getHours();
      
      while (currentHour <= endHour) {
        // Fetch if not cached
        if (slotDemandCache[currentHour] == null) {
          const hourTime = `${String(currentHour).padStart(2, '0')}:00`;
          fetchSlotDemand(hourTime);
        }
        currentHour++;
      }
    }
  }, [customBooking.startTime, customBooking.endTime]);

  // Calculate duration and cost when times change - WITH WEIGHTED AVERAGE DYNAMIC PRICING
  useEffect(() => {
    if (customBooking.startTime && customBooking.endTime) {
      const start = new Date(`${customBooking.date}T${customBooking.startTime}`);
      const end = new Date(`${customBooking.date}T${customBooking.endTime}`);
      
      if (end > start) {
        const durationHours = (end - start) / (1000 * 60 * 60);
        
        // Get weighted average dynamic price for this time slot
        const slotAveragePrice = calculateSlotAveragePrice(customBooking.startTime, customBooking.endTime);
        const cost = Math.ceil(durationHours * slotAveragePrice);
        
        setCustomBooking(prev => ({
          ...prev,
          duration: durationHours,
          estimatedCost: cost,
          dynamicPrice: slotAveragePrice // Store the weighted average price
        }));
      }
    }
  }, [customBooking.startTime, customBooking.endTime, customBooking.date, charger, slotDemandCache]);

  const handleBookSlot = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { redirectTo: `/chargers/${id}` } });
      return;
    }

    // Validate custom booking
    if (!customBooking.startTime || !customBooking.endTime) {
      setToastMessage({ type: 'error', text: 'Please select start and end times' });
      return;
    }

    if (customBooking.duration <= 0) {
      setToastMessage({ type: 'error', text: 'End time must be after start time' });
      return;
    }

    setBookingLoading(true);
    try {
      const startDateTime = new Date(`${customBooking.date}T${customBooking.startTime}`).toISOString();
      const endDateTime = new Date(`${customBooking.date}T${customBooking.endTime}`).toISOString();
      
      console.log('Creating booking with:', { chargerId: id, startDateTime, endDateTime });
      
      // Find matching slot for the selected time range
      const matchingSlot = slots.find(slot => {
        const slotStart = new Date(slot.startTime);
        const slotEnd = new Date(slot.endTime);
        const bookingStart = new Date(startDateTime);
        const bookingEnd = new Date(endDateTime);
        
        // Check if booking exactly matches this slot or falls within it
        return slotStart.getTime() === bookingStart.getTime() && 
               slotEnd.getTime() === bookingEnd.getTime() &&
               slot.status === 'available';
      });
      
      console.log('Matching slot found:', matchingSlot);
      
      // Step 1: Create booking
      const bookingData = {
        chargerId: id,
        startTime: startDateTime,
        endTime: endDateTime,
      };
      
      // Include slotId if an exact matching slot was found
      if (matchingSlot?._id) {
        bookingData.slotId = matchingSlot._id;
        console.log('Using slot ID:', matchingSlot._id);
      }
      
      const res = await bookingService.create(bookingData);

      console.log('Booking created:', res);
      const bookingObj = res.data?.booking || res.data;
      
      // Step 2: Automatically pay with wallet
      try {
        console.log('Processing payment for booking:', bookingObj._id);
        
        const paymentRes = await api.post('/payments/wallet/pay', { 
          bookingId: bookingObj._id 
        });

        console.log('Payment response:', paymentRes.data);

        if (paymentRes.data?.success) {
          // Update user wallet balance in context
          if (paymentRes.data.data?.walletBalance !== undefined) {
            updateUser({ ...user, walletBalance: paymentRes.data.data.walletBalance });
          }
          
          setBookingModalOpen(false);
          setToastMessage({ type: 'success', text: 'Payment successful! Booking confirmed.' });
          
          if (bookingObj?._id) {
            setTimeout(() => navigate(`/bookings/${bookingObj._id}`), 1200);
          } else {
            setTimeout(() => navigate('/my-bookings'), 1200);
          }
        } else {
          throw new Error(paymentRes.data?.error?.message || 'Payment failed');
        }
      } catch (paymentError) {
        // Booking created but payment failed
        console.error('Payment error:', paymentError);
        console.error('Payment error response:', paymentError.response?.data);
        
        setBookingModalOpen(false);
        
        const errorMsg = paymentError.response?.data?.error?.message 
          || paymentError.message 
          || 'Booking created but payment failed. Please complete payment from My Bookings.';
        
        setToastMessage({
          type: 'error',
          text: errorMsg,
        });
        
        // If insufficient balance, redirect to wallet
        if (errorMsg.includes('Insufficient') || errorMsg.includes('balance')) {
          setTimeout(() => navigate('/wallet'), 2000);
        } else {
          setTimeout(() => navigate('/my-bookings'), 2000);
        }
      }
    } catch (err) {
      console.error('Booking creation error:', err);
      console.error('Booking error response:', err.response?.data);
      
      setBookingModalOpen(false);
      const isConflict = err.response?.status === 409 || err.response?.data?.error?.code === 'BOOKING_CONFLICT';
      const errorMsg = isConflict
        ? 'This time slot overlaps with an existing booking. Please choose different times.'
        : (err.response?.data?.error?.message || 'Failed to complete booking. Check wallet balance.');
      setToastMessage({
        type: 'error',
        text: errorMsg,
      });
    } finally {
      setBookingLoading(false);
    }
  };

  // Calculate position and width for Gantt bars (0:00 to 23:59 = 100%)
  const calculateGanttPosition = (startTime, endTime) => {
    const dayStart = new Date(`${customBooking.date}T00:00:00`);
    const totalDayMinutes = 24 * 60;
    
    const slotStart = new Date(startTime);
    const slotEnd = new Date(endTime);
    
    const startMinutes = (slotStart - dayStart) / (1000 * 60);
    const endMinutes = (slotEnd - dayStart) / (1000 * 60);
    
    const left = (startMinutes / totalDayMinutes) * 100;
    const width = ((endMinutes - startMinutes) / totalDayMinutes) * 100;
    
    return { left: Math.max(0, left), width: Math.max(0.5, width) };
  };

  // Generate timeline for selected date
  const generateDriverTimeline = () => {
    // Filter bookings for selected date AND this specific charger
    const dateBookings = ganttBookings.filter(booking => {
      const bookingDate = new Date(booking.startTime).toISOString().split('T')[0];
      const isThisCharger = booking.charger === id || booking.charger?._id === id;
      return bookingDate === customBooking.date && isThisCharger;
    });

    // Also get blocked slots for this date AND this specific charger
    const dateSlots = slots.filter(slot => {
      const slotDate = new Date(slot.startTime).toISOString().split('T')[0];
      const isThisCharger = slot.charger === id || slot.charger?._id === id;
      const isBlockedOrOccupied = slot.status === 'blocked' || slot.status === 'occupied' || slot.status === 'reserved';
      return slotDate === customBooking.date && isThisCharger && isBlockedOrOccupied;
    });

    // Combine and normalize - everything shows as "occupied" to drivers
    const combined = [
      ...dateBookings.map(b => ({
        _id: b._id,
        startTime: b.startTime,
        endTime: b.endTime,
        status: 'occupied',
        type: 'booking'
      })),
      ...dateSlots.map(s => ({
        _id: s._id,
        startTime: s.startTime,
        endTime: s.endTime,
        status: 'occupied', // Show blocked as occupied to drivers
        type: 'slot'
      }))
    ];

    return combined.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  };

  const driverTimeline = generateDriverTimeline();

  const startHostChat = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { redirectTo: `/chargers/${id}` } });
      return;
    }
    navigate(`/chats`, { state: { chargerId: id } });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton variant="title" width="40%" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton variant="card" className="h-64" />
            <Skeleton variant="card" className="h-40" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton variant="card" className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  if (!charger) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Station Not Found</h2>
        <p className="text-slate-500 mt-2">The requested EV charger may have been unlisted or removed.</p>
        <Link to="/chargers" className="mt-4 inline-block">
          <Button variant="primary">Return to Discovery Map</Button>
        </Link>
      </div>
    );
  }

  const basePrice = charger.pricePerHour || 15;
  const currentPpoPrice = pricingInfo?.recommendedPrice || pricingInfo?.currentPrice || basePrice;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {toastMessage && (
        <Toast
          type={toastMessage.type}
          message={toastMessage.text}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Discovery Map
        </button>

        <Button variant="secondary" size="sm" icon={MessageSquare} onClick={startHostChat}>
          Chat with Host
        </Button>
      </div>

      {/* Station Title Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={charger.isAvailable !== false ? 'success' : 'neutral'} dot>
              {charger.isAvailable !== false ? 'Available Now' : 'Busy'}
            </Badge>
            <span className="text-xs font-semibold text-slate-500">• {charger.chargerType || 'Level 2 Fast'}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {charger.title || charger.name || 'EV Charger Point'}
          </h1>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <p className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              {charger.address || charger.location?.address || 'Location registered'}
            </p>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1 font-semibold text-slate-800">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{charger.rating != null ? Number(charger.rating).toFixed(1) : (reviews.length ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : 'New')}</span>
              <span className="text-slate-400 font-normal">({charger.totalRatings || reviews.length} {((charger.totalRatings || reviews.length) === 1 ? 'review' : 'reviews')})</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 text-right">
          <p className="text-xs font-semibold text-slate-500">Hourly Rate</p>
          <p className="text-2xl font-extrabold text-emerald-700">₹{currentPpoPrice}/hr</p>
        </div>
      </div>

      {/* Main Grid: Specifications, AI Tariff & Slot Picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Specs & AI Tariff Timeline */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Charger Gallery / Specs */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Station Specifications</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 font-semibold block">Power Output</span>
                <span className="text-sm font-extrabold text-slate-900 flex items-center gap-1">
                  <Zap className="w-4 h-4 text-amber-500" /> {charger.powerOutput || 22} kW
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 font-semibold block">Connector Type</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {charger.connectorType || 'CCS2'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 font-semibold block">Host Payout Guarantee</span>
                <span className="text-sm font-extrabold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Verified Host
                </span>
              </div>
            </div>

            {charger.description && (
              <div className="pt-2 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-800 mb-1">Host Description:</p>
                <p>{charger.description}</p>
              </div>
            )}
          </Card>

          {/* Compact Reviews Section */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reviews</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const avg = Number(charger.rating || (reviews.length ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 0));
                      return (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(avg)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200 fill-slate-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-sm font-extrabold text-slate-900">
                    {charger.rating != null ? Number(charger.rating).toFixed(1) : (reviews.length ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : 'New')}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({charger.totalRatings || reviews.length} {((charger.totalRatings || reviews.length) === 1 ? 'review' : 'reviews')})
                  </span>
                </div>
              </div>

              <Button
                variant={showReviewForm ? 'neutral' : 'secondary'}
                size="sm"
                onClick={() => {
                  setShowReviewForm(!showReviewForm);
                  setReviewError('');
                  setReviewSuccess('');
                }}
              >
                {showReviewForm ? 'Cancel' : 'Write a Review'}
              </Button>
            </div>

            {/* Review Form */}
            {showReviewForm && (
              <form onSubmit={handleSubmitReview} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Write Your Review</h4>
                
                {reviewError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                    {reviewError}
                  </div>
                )}

                {reviewSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                    {reviewSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rating</label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setReviewRating(s)}
                        className="p-1 hover:scale-110 transition-transform focus:outline-none"
                      >
                        <Star
                          className={`w-6 h-6 cursor-pointer ${
                            s <= reviewRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-700 ml-2">{reviewRating} / 5 Stars</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Comment</label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (e.g. good location, reliable charging speed)..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              </form>
            )}

            {/* Individual Reviews List */}
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  No reviews yet for this charger.
                </p>
              ) : (
                reviews.map((rev) => (
                  <div key={rev._id} className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
                          {rev.user?.name?.[0] || 'D'}
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          {rev.user?.name || 'User'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </span>
                    </div>

                    <div className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= rev.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200 fill-slate-100'
                          }`}
                        />
                      ))}
                    </div>

                    {rev.comment && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        "{rev.comment}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Demand & Pricing Insights Card - Dynamic Based on Selected Slot with REAL ML */}
          {(() => {
            // Use selected slot's dynamic pricing if available, otherwise use current
            const selectedSlotPrice = customBooking.dynamicPrice || currentPpoPrice;
            const selectedSlotHour = customBooking.startTime 
              ? new Date(`${customBooking.date}T${customBooking.startTime}`).getHours()
              : new Date().getHours();
            
            // Get REAL ML demand for selected time slot from cache or current demandInfo
            let slotDemandValue;
            if (customBooking.startTime && slotDemandCache[selectedSlotHour] != null) {
              // Use cached ML prediction for selected slot
              slotDemandValue = slotDemandCache[selectedSlotHour];
            } else if (!customBooking.startTime && demandInfo?.demandValue != null) {
              // Use current ML prediction
              slotDemandValue = demandInfo.demandValue;
            } else {
              // Fallback to rule-based heuristic
              if (selectedSlotHour >= 6 && selectedSlotHour < 9) slotDemandValue = 0.75;
              else if (selectedSlotHour >= 9 && selectedSlotHour < 12) slotDemandValue = 0.5;
              else if (selectedSlotHour >= 12 && selectedSlotHour < 14) slotDemandValue = 0.65;
              else if (selectedSlotHour >= 14 && selectedSlotHour < 17) slotDemandValue = 0.4;
              else if (selectedSlotHour >= 17 && selectedSlotHour < 20) slotDemandValue = 0.85;
              else if (selectedSlotHour >= 20 && selectedSlotHour < 23) slotDemandValue = 0.55;
              else slotDemandValue = 0.2;
            }
            
            const demandState = getDemandState(slotDemandValue);
            const isXGBoost = demandInfo?.source === 'XGBOOST_MODEL_SERVICE' || slotDemandCache[selectedSlotHour] != null;
            const priceDiff = selectedSlotPrice - basePrice;

            return (
              <Card className="p-6 space-y-5 bg-white border border-emerald-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Demand &amp; Pricing Insights</h3>
                    <p className="text-xs text-slate-500">
                      {customBooking.startTime 
                        ? `ML prediction for: ${customBooking.startTime} - ${customBooking.endTime || '...'}`
                        : 'Real-time ML demand prediction & transparent pricing'
                      }
                    </p>
                  </div>
                  <div>
                    {isXGBoost && demandState ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        {slotDemandCache[selectedSlotHour] != null ? 'Slot ML' : 'XGBoost'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <Activity className="w-3.5 h-3.5 text-amber-600" />
                        Heuristic
                      </span>
                    )}
                  </div>
                </div>

                {/* Current Demand Meter */}
                {demandState ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        {customBooking.startTime ? 'Slot demand forecast' : 'Current demand'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${demandState.badgeColor}`}>
                          {demandState.label}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {demandState.percent}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${demandState.barColor}`}
                        style={{ width: `${Math.max(10, Math.min(100, demandState.percent))}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600">{demandState.description}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <Info className="w-4 h-4 text-slate-500" />
                      <span>Demand prediction unavailable</span>
                    </div>
                  </div>
                )}

                {/* Pricing Breakdown */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Why this price?</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 font-medium block">
                        {customBooking.startTime ? 'Slot price' : 'Current price'}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                        ₹{selectedSlotPrice}/hr
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 font-medium block">Base price</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                        ₹{basePrice}/hr
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 font-medium block">Demand surge</span>
                      <span className={`text-sm font-bold mt-0.5 block ${priceDiff > 0 ? 'text-amber-700' : priceDiff < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {priceDiff > 0 ? '+' : ''}{priceDiff > 0 ? `₹${priceDiff}` : priceDiff < 0 ? `-₹${Math.abs(priceDiff)}` : '₹0'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 font-medium block">Available slots</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                        {slots.filter(s => s.status === 'available').length}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* 24-Hour Demand & Dynamic Rates Chart - REAL ML DATA */}
          <Demand24HourChart 
            chargerId={id}
            stationName={charger?.title}
            date={customBooking.date}
            basePrice={charger?.pricing?.basePrice || basePrice}
            loading={loading}
          />
        </div>

        {/* Right Column: Flexible Time Slot Booking */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Book Your Charging Time</h3>
                <p className="text-xs text-slate-500">Choose your preferred duration</p>
              </div>
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>

            {/* Date Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Select Date</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={customBooking.date}
                onChange={(e) => setCustomBooking(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Gantt Chart Timeline - Always Visible to Drivers */}
            <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-3">
                Availability for {new Date(customBooking.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
                
                {/* Time ruler */}
                <div className="relative mb-2">
                  <div className="flex justify-between text-[9px] text-gray-500 font-mono px-1">
                    {Array.from({ length: 13 }, (_, i) => i * 2).map(i => (
                      <span key={i} className="font-bold">
                        {String(i).padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                  <div className="h-1.5 bg-gradient-to-r from-green-200 via-emerald-200 to-green-200 rounded-full mt-1"></div>
                </div>

                {/* Timeline bars */}
                <div className="space-y-1.5 min-h-[80px]">
                  {driverTimeline.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-gray-400 text-xs">
                      <div className="text-center">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1 opacity-50 text-green-500" />
                        <p>Fully available - Pick any time!</p>
                      </div>
                    </div>
                  ) : (
                    driverTimeline.map((item) => {
                      const { left, width } = calculateGanttPosition(item.startTime, item.endTime);
                      const itemStart = new Date(item.startTime);
                      const itemEnd = new Date(item.endTime);
                      const durationHours = ((itemEnd - itemStart) / (1000 * 60 * 60)).toFixed(1);
                      
                      // Show everything as just "OCCUPIED" to drivers
                      return (
                        <div key={item._id} className="relative h-8">
                          <div className="absolute inset-0 bg-white rounded border border-gray-200"></div>
                          <div
                            className="absolute top-0.5 bottom-0.5 bg-red-500 border-red-600 rounded border-2 shadow-sm overflow-hidden"
                            style={{ left: `${left}%`, width: `${width}%`, minWidth: '2%' }}
                            title={`OCCUPIED\n${itemStart.toLocaleTimeString()} - ${itemEnd.toLocaleTimeString()}`}
                          >
                            <div className="flex items-center justify-between h-full px-2 text-white text-[10px] font-bold">
                              <span className="truncate">OCCUPIED</span>
                              <span>{durationHours}h</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Legend */}
                <div className="mt-3 pt-3 border-t border-slate-300 flex gap-4 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-3 bg-red-500 rounded border border-red-600"></div>
                    <span className="text-gray-600">Occupied (Not Available)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-3 bg-green-200 rounded border border-green-300"></div>
                    <span className="text-gray-600">Available for Booking</span>
                  </div>
                </div>
              </div>

              {/* Duration Filter Buttons - ABOVE SLOTS */}
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-700 mb-2">Filter by duration:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDuration(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedDuration === null
                        ? 'bg-emerald-500 text-white border-2 border-emerald-600'
                        : 'bg-white text-slate-700 border-2 border-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    All Slots
                  </button>
                  {[0.5, 1, 2, 4].map(duration => (
                    <button
                      key={duration}
                      onClick={() => setSelectedDuration(duration)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedDuration === duration
                          ? 'bg-emerald-500 text-white border-2 border-emerald-600'
                          : 'bg-white text-slate-700 border-2 border-slate-300 hover:border-emerald-400'
                      }`}
                    >
                      {duration === 0.5 ? '30min' : `${duration}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart Available Slots with ML Demand & Weighted Average Dynamic Pricing */}
              {(() => {
                // Generate diverse time slots throughout the day (not just at gap starts)
                const generateTimeSlots = () => {
                  const slots = [];
                  const selectedDate = customBooking.date;
                  
                  // Durations to offer - filter if user selected one
                  const allDurations = [0.5, 1, 2, 4];
                  const durations = selectedDuration ? [selectedDuration] : allDurations;
                  
                  // Generate slots every 2 hours throughout the day
                  const startHours = [0, 2, 6, 8, 10, 12, 14, 16, 18, 20, 22];
                  
                  startHours.forEach(startHour => {
                    durations.forEach(duration => {
                      const startTime = new Date(`${selectedDate}T${String(startHour).padStart(2, '0')}:00:00`);
                      const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
                      
                      // Check if this slot overlaps with any booking
                      const isOccupied = driverTimeline.some(booking => {
                        const bookingStart = new Date(booking.startTime);
                        const bookingEnd = new Date(booking.endTime);
                        return (startTime < bookingEnd && endTime > bookingStart);
                      });
                      
                      // Only add if not occupied
                      if (!isOccupied && endTime.getDate() === startTime.getDate()) {
                        // Calculate WEIGHTED AVERAGE demand and price for this multi-hour slot
                        const basePriceValue = charger?.pricing?.basePrice || basePrice;
                        let totalWeightedDemand = 0;
                        let totalWeightedPrice = 0;
                        const durationMs = endTime - startTime;
                        
                        let currentHourStart = new Date(startTime);
                        while (currentHourStart < endTime) {
                          const hour = currentHourStart.getHours();
                          const nextHourStart = new Date(currentHourStart);
                          nextHourStart.setHours(hour + 1, 0, 0, 0);
                          
                          const hourEnd = nextHourStart > endTime ? endTime : nextHourStart;
                          const hourDurationMs = hourEnd - (currentHourStart > startTime ? currentHourStart : startTime);
                          const hourWeight = hourDurationMs / durationMs;
                          
                          // Get demand for this hour
                          let demandValue = slotDemandCache[hour];
                          if (demandValue == null) {
                            if (hour >= 6 && hour < 9) demandValue = 0.75;
                            else if (hour >= 9 && hour < 12) demandValue = 0.5;
                            else if (hour >= 12 && hour < 14) demandValue = 0.65;
                            else if (hour >= 14 && hour < 17) demandValue = 0.4;
                            else if (hour >= 17 && hour < 20) demandValue = 0.85;
                            else if (hour >= 20 && hour < 23) demandValue = 0.55;
                            else demandValue = 0.2;
                          }
                          
                          totalWeightedDemand += demandValue * hourWeight;
                          
                          // Calculate price for this hour
                          const demandPercent = Math.round(demandValue * 100);
                          const surgeFactor = 1 + (demandPercent / 100) * 0.5;
                          const hourPrice = basePriceValue * surgeFactor;
                          totalWeightedPrice += hourPrice * hourWeight;
                          
                          currentHourStart = nextHourStart;
                        }
                        
                        const averageDemand = totalWeightedDemand;
                        const demandState = getDemandState(averageDemand);
                        const dynamicPrice = Math.ceil(totalWeightedPrice);
                        const estimatedCost = Math.ceil(duration * dynamicPrice);
                        
                        slots.push({
                          start: startTime,
                          end: endTime,
                          duration,
                          demandState,
                          demandValue: averageDemand,
                          dynamicPrice,
                          estimatedCost
                        });
                      }
                    });
                  });
                  
                  return slots;
                };

                const availableSlots = generateTimeSlots();
                
                // Sort by cost (cheapest first) to identify best option
                availableSlots.sort((a, b) => a.estimatedCost - b.estimatedCost);
                const bestSlot = availableSlots[0];

                // Re-sort by time for display
                availableSlots.sort((a, b) => a.start - b.start);

                return availableSlots.length > 0 ? (
                  <div className="mt-4 p-4 bg-gradient-to-br from-emerald-50/80 to-blue-50/50 border border-emerald-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Available Slots with Smart Pricing
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                        ML-Powered
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">
                      Click any slot to see live pricing • Each slot has different demand-based rates
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                      {availableSlots.slice(0, 12).map((slot, idx) => {
                        const startTime = slot.start.toTimeString().slice(0, 5);
                        const endTime = slot.end.toTimeString().slice(0, 5);
                        const isBest = slot === bestSlot;
                        const isSelected = customBooking.startTime === startTime && customBooking.endTime === endTime;
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setCustomBooking(prev => ({
                                ...prev,
                                startTime,
                                endTime
                              }));
                            }}
                            className={`w-full flex flex-col p-2 rounded-lg transition-all text-left group ${
                              isSelected 
                                ? 'bg-emerald-100 border-2 border-emerald-500 shadow-md' 
                                : isBest
                                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-400 hover:shadow-md'
                                : 'bg-white border-2 border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                            }`}
                          >
                            {/* Badge Row */}
                            <div className="flex items-center justify-end mb-1.5">
                              {isBest && !isSelected && (
                                <span className="px-1.5 py-0.5 bg-amber-400 text-amber-900 text-[8px] font-black rounded border border-amber-600 uppercase leading-tight">
                                  Best
                                </span>
                              )}
                              {isSelected && (
                                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] font-black rounded uppercase leading-tight">
                                  Active
                                </span>
                              )}
                            </div>

                            {/* Time Display */}
                            <div className="text-xs font-bold text-slate-900 mb-1.5">
                              {startTime} - {endTime}
                            </div>

                            {/* Demand Badge */}
                            <div className="mb-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold border ${slot.demandState.badgeColor} inline-block`}>
                                {slot.demandState.label}
                              </span>
                            </div>

                            {/* Duration & Rate */}
                            <div className="text-[9px] text-slate-600 font-medium mb-1.5">
                              {slot.duration.toFixed(1)}h @ ₹{slot.dynamicPrice}/hr
                            </div>

                            {/* Price */}
                            <div className={`text-base font-extrabold ${
                              isSelected ? 'text-emerald-800' : isBest ? 'text-amber-800' : 'text-emerald-700 group-hover:text-emerald-800'
                            }`}>
                              ₹{slot.estimatedCost}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-200/50 text-[10px] text-slate-500 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Yellow = best price. Prices vary by time-of-day demand. Night slots are cheaper!
                    </div>
                  </div>
                ) : driverTimeline.length > 0 ? (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-600 text-center flex items-center justify-center gap-2">
                      <Info className="w-4 h-4" />
                      All slots occupied on this date. Try another date.
                    </p>
                  </div>
                ) : null;
              })()}

            {/* Time Range Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={customBooking.startTime}
                  onChange={(e) => setCustomBooking(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={customBooking.endTime}
                  onChange={(e) => setCustomBooking(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Quick Duration Presets */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Quick Select:</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '30m', hours: 0.5 },
                  { label: '1h', hours: 1 },
                  { label: '2h', hours: 2 },
                  { label: '4h', hours: 4 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      // Use the selected date, not current date
                      const selectedDate = customBooking.date || new Date().toISOString().split('T')[0];
                      const now = new Date();
                      
                      // Create start time based on current time
                      const startHours = now.getHours();
                      const startMinutes = now.getMinutes();
                      const start = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
                      
                      // Calculate end time by adding preset duration
                      const startDateTime = new Date(`${selectedDate}T${start}`);
                      const endDateTime = new Date(startDateTime.getTime() + preset.hours * 60 * 60 * 1000);
                      
                      // Format end time
                      const endHours = endDateTime.getHours();
                      const endMinutes = endDateTime.getMinutes();
                      const end = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
                      
                      setCustomBooking(prev => ({
                        ...prev,
                        startTime: start,
                        endTime: end
                      }));
                    }}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Booking Summary */}
            {customBooking.duration > 0 && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Duration:</span>
                  <span className="font-bold text-slate-900">
                    {customBooking.duration.toFixed(1)} hours
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Rate:</span>
                  <span className="font-bold text-slate-900">
                    ₹{customBooking.dynamicPrice || currentPpoPrice}/hr
                    {customBooking.dynamicPrice && customBooking.dynamicPrice !== currentPpoPrice && (
                      <span className="ml-1 text-[10px] text-amber-700 font-extrabold">
                        (Dynamic)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-emerald-200 pt-2">
                  <span className="text-slate-700 font-semibold">Estimated Cost:</span>
                  <span className="font-extrabold text-emerald-700 text-lg">
                    ₹{customBooking.estimatedCost}
                  </span>
                </div>
              </div>
            )}

            {/* Host Availability Info */}
            {charger.availabilitySchedule && charger.availabilitySchedule.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Host Availability
                </p>
                <p className="text-xs text-blue-700">
                  Typically available during configured hours. Instant confirmation upon booking.
                </p>
              </div>
            )}

            <Button
              variant="primary"
              disabled={!customBooking.startTime || !customBooking.endTime || customBooking.duration <= 0}
              className="w-full py-3"
              onClick={() => setBookingModalOpen(true)}
            >
              {isAuthenticated ? 'Proceed to Book' : 'Log In to Reserve'}
            </Button>
          </Card>

          {/* Existing Bookings Timeline (Optional) */}
          {slots.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                Today's Bookings
              </h4>
              <div className="space-y-1.5">
                {slots.filter(s => s.status !== 'available').slice(0, 5).map(slot => (
                  <div key={slot._id} className="flex items-center gap-2 text-xs">
                    <div className="flex-1 bg-red-100 border border-red-200 rounded px-2 py-1">
                      <span className="text-red-800 font-semibold">
                        {formatTime(slot.startTime, slotTimezone)} - {formatTime(slot.endTime, slotTimezone)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">Occupied</span>
                  </div>
                ))}
                {slots.filter(s => s.status !== 'available').length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No bookings yet today</p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      <Modal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        title="Confirm Charging Reservation"
        subtitle="Review your booking details before confirming"
      >
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Station:</span>
              <span className="font-bold text-slate-900">{charger.title || charger.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span className="font-bold text-slate-900">
                {new Date(customBooking.date).toLocaleDateString('en-US', { 
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Time:</span>
              <span className="font-bold text-slate-900">
                {customBooking.startTime} - {customBooking.endTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duration:</span>
              <span className="font-bold text-slate-900">
                {customBooking.duration.toFixed(1)} hours
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold">
              <span className="text-slate-800">Total Amount:</span>
              <span className="text-emerald-600">₹{customBooking.estimatedCost}</span>
            </div>
          </div>

          {/* Wallet Balance Info */}
          {user && (
            <div className={`p-3 rounded-xl border ${
              (user.walletBalance || 0) >= customBooking.estimatedCost
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex justify-between items-center text-xs">
                <span className={`font-semibold ${
                  (user.walletBalance || 0) >= customBooking.estimatedCost
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}>
                  Your Wallet Balance:
                </span>
                <span className={`text-lg font-bold ${
                  (user.walletBalance || 0) >= customBooking.estimatedCost
                    ? 'text-green-900'
                    : 'text-red-900'
                }`}>
                  ₹{(user.walletBalance || 0).toFixed(2)}
                </span>
              </div>
              {(user.walletBalance || 0) < customBooking.estimatedCost && (
                <p className="text-xs text-red-600 mt-2">
                  Insufficient balance. Please add ₹{(customBooking.estimatedCost - (user.walletBalance || 0)).toFixed(2)} to your wallet.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Payment will be deducted from your wallet balance. You'll receive instant confirmation.
          </p>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setBookingModalOpen(false)}>
              Cancel
            </Button>
            {user && (user.walletBalance || 0) < customBooking.estimatedCost ? (
              <Button 
                variant="primary" 
                className="flex-1" 
                onClick={() => {
                  setBookingModalOpen(false);
                  navigate('/wallet');
                }}
              >
                Add Money
              </Button>
            ) : (
              <Button variant="primary" className="flex-1" loading={bookingLoading} onClick={handleBookSlot}>
                Confirm & Pay ₹{customBooking.estimatedCost}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ChargerDetail;
