import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { bookingService } from '../services/bookingService.js';
import { chatService } from '../services/chatService.js';
import { reviewService } from '../services/reviewService.js';
import {
  Calendar,
  Clock,
  MapPin,
  Zap,
  MessageSquare,
  Star,
  Receipt,
  Navigation,
  ArrowRight,
  Filter,
  CheckCircle2,
  TrendingDown,
  ShieldCheck,
  Search,
  PlusCircle,
  Sparkles,
  Download,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';

const MyBookings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'upcoming', 'completed'
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [locationFilter, setLocationFilter] = useState('');
  
  const [reviewModal, setReviewModal] = useState({ open: false, booking: null, mode: 'add' });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [bookingReviews, setBookingReviews] = useState({});
  const [chatLoadingId, setChatLoadingId] = useState(null);
  const [chatErrorByBooking, setChatErrorByBooking] = useState({});
  const [deleteReviewLoadingId, setDeleteReviewLoadingId] = useState(null);

  const formatBookingDateTime = (value) => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleString();
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (user?._id) {
      fetchUserReviews();
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      setError('');
      const response = await bookingService.getAll({ type: 'bookings' });
      const fetchedBookings = response.data?.bookings || response.data || [];
      setBookings(Array.isArray(fetchedBookings) ? fetchedBookings : []);

      setBookingReviews((prev) => {
        const next = { ...prev };
        (Array.isArray(fetchedBookings) ? fetchedBookings : []).forEach((booking) => {
          if (booking.review) {
            next[booking._id] = booking.review;
          }
        });
        return next;
      });
    } catch (err) {
      console.error('Error fetching authentic bookings from MongoDB:', err);
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load bookings from server.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserReviews = async () => {
    if (!user?._id) return;
    try {
      const res = await reviewService.getByUser(user._id);
      const mapped = (res.data?.reviews || []).reduce((acc, review) => {
        if (review.booking) {
          acc[review.booking] = review;
        }
        return acc;
      }, {});
      setBookingReviews((prev) => ({ ...mapped, ...prev }));
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const openReviewModal = (booking, mode = 'add') => {
    const existing = bookingReviews[booking._id];
    setReviewModal({ open: true, booking, mode });
    setReviewForm({
      rating: existing?.rating ?? 5,
      comment: existing?.comment ?? '',
    });
    setReviewError('');
    setReviewMessage('');
  };

  const closeReviewModal = () => {
    setReviewModal({ open: false, booking: null, mode: 'add' });
    setReviewForm({ rating: 5, comment: '' });
    setReviewSubmitting(false);
    setReviewError('');
  };

  const submitReview = async () => {
    if (!reviewModal.booking) return;
    const bookingId = reviewModal.booking._id;
    try {
      setReviewSubmitting(true);
      setReviewError('');
      setReviewMessage('');
      let response;
      if (reviewModal.mode === 'edit' && bookingReviews[bookingId]) {
        response = await reviewService.update(bookingReviews[bookingId]._id, {
          rating: Number(reviewForm.rating),
          comment: reviewForm.comment,
        });
      } else {
        response = await reviewService.create({
          bookingId,
          rating: Number(reviewForm.rating),
          comment: reviewForm.comment,
        });
      }

      const savedReview = response?.data?.review;
      if (savedReview) {
        setBookingReviews((prev) => ({ ...prev, [bookingId]: savedReview }));
      }

      setReviewMessage(reviewModal.mode === 'edit' ? 'Review updated successfully.' : 'Review submitted. Thank you!');
      closeReviewModal();
      fetchUserReviews();
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to submit review';
      setReviewError(message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (bookingId, reviewId) => {
    if (!reviewId) return;
    try {
      setDeleteReviewLoadingId(bookingId);
      setReviewError('');
      setReviewMessage('');
      await reviewService.remove(reviewId);
      setBookingReviews((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      setReviewMessage('Review deleted.');
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to delete review';
      setReviewError(message);
    } finally {
      setDeleteReviewLoadingId(null);
    }
  };

  const handleMessageOwner = async (booking) => {
    if (!booking) return;
    try {
      setChatLoadingId(booking._id);
      setChatErrorByBooking((prev) => ({ ...prev, [booking._id]: '' }));
      const res = await chatService.startOrUpgrade({ chargerId: booking.charger._id, bookingId: booking._id });
      const chatId = res.data?.chat?._id;
      if (chatId) {
        navigate(`/chats/${chatId}`, { state: { chargerId: booking.charger._id, bookingId: booking._id } });
      } else {
        navigate('/chats');
      }
    } catch (err) {
      navigate('/chats');
    } finally {
      setChatLoadingId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    const sorted = [...bookings].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    return sorted.filter((booking) => {
      // Tab Filtering
      const bStatus = (booking.status || '').toLowerCase();
      if (activeTab === 'active' && bStatus !== 'active' && bStatus !== 'in_progress') return false;
      if (activeTab === 'upcoming' && bStatus !== 'confirmed' && bStatus !== 'pending') return false;
      if (activeTab === 'completed' && bStatus !== 'completed') return false;

      // Date Range Filtering
      const start = new Date(booking.startTime).getTime();
      const matchesStart = dateRange.start ? start >= new Date(dateRange.start).getTime() : true;
      const matchesEnd = dateRange.end ? start <= new Date(dateRange.end).getTime() : true;

      // Location Filtering
      const locationText = `${booking.charger?.location?.address || ''} ${booking.charger?.location?.city || ''} ${booking.charger?.location?.state || ''}`.toLowerCase();
      const matchesLocation = locationFilter
        ? locationText.includes(locationFilter.trim().toLowerCase())
        : true;

      return matchesStart && matchesEnd && matchesLocation;
    });
  }, [bookings, activeTab, dateRange, locationFilter]);

  const totalSpent = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const activeSessionsCount = bookings.filter((b) => b.status === 'active' || b.status === 'in_progress').length;
  const completedSessionsCount = bookings.filter((b) => b.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-evsathi-mint/40 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-evsathi-soft text-evsathi-dark text-xs font-extrabold border border-evsathi-mint mb-2">
            <Calendar className="w-3.5 h-3.5 text-evsathi-teal" />
            <span>P2P Charging Session History</span>
          </div>
          <h1 className="text-3xl font-extrabold text-evsathi-dark tracking-tight">
            My Charging Bookings
          </h1>
          <p className="text-sm text-evsathi-slate mt-1">
            Track active charges, reserved slots, session receipts, and host messages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/chargers">
            <Button variant="primary" icon={Zap}>
              Book New Session
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="p-5 bg-white border border-evsathi-mint/40 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-evsathi-muted uppercase">Total Sessions</p>
              <h3 className="text-2xl font-extrabold text-evsathi-dark mt-1">{bookings.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-evsathi-light text-evsathi-teal flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-evsathi-slate mt-3 font-semibold">P2P Host Bookings</p>
        </Card>

        <Card className="p-5 bg-white border border-evsathi-mint/40 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-evsathi-muted uppercase">Active Charging</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{activeSessionsCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-700 mt-3 font-semibold">In Progress Right Now</p>
        </Card>

        <Card className="p-5 bg-white border border-evsathi-mint/40 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-evsathi-muted uppercase">Total Spent</p>
              <h3 className="text-2xl font-extrabold text-evsathi-teal mt-1">₹{totalSpent}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-evsathi-light text-evsathi-teal flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-evsathi-slate mt-3 font-semibold">Razorpay Direct Receipts</p>
        </Card>

        <Card className="p-5 bg-white border border-evsathi-mint/40 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-evsathi-muted uppercase">Off-Peak Savings</p>
              <h3 className="text-2xl font-extrabold text-evsathi-dark mt-1">₹142</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-evsathi-soft text-evsathi-dark flex items-center justify-center font-bold">
              <TrendingDown className="w-5 h-5 text-evsathi-teal" />
            </div>
          </div>
          <p className="text-[11px] text-evsathi-slate mt-3 font-semibold">Smart Rate Off-Peak Benefit</p>
        </Card>
      </div>

      {/* Filter Tabs & Search Controls */}
      <Card className="p-4 bg-white border border-evsathi-mint/40 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-evsathi-soft/60 pb-3">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-evsathi-light rounded-xl border border-evsathi-soft w-full sm:w-auto">
            {[
              { id: 'all', label: 'All Sessions' },
              { id: 'active', label: 'Active ⚡' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  activeTab === tab.id
                    ? 'bg-evsathi-teal text-white shadow-xs'
                    : 'text-evsathi-slate hover:text-evsathi-dark'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Location Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-evsathi-teal absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search station or city..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark placeholder-evsathi-muted focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
            />
          </div>
        </div>
      </Card>

      {/* Messages / Notifications */}
      {reviewMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{reviewMessage}</span>
        </div>
      )}

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => {
            const review = bookingReviews[booking._id];
            const isCompleted = booking.status === 'completed';
            const isActive = booking.status === 'active' || booking.status === 'in_progress';

            return (
              <Card key={booking._id} className="p-6 bg-white border border-evsathi-mint/40 shadow-xs hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  
                  {/* Left Column: Station & Session Info */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-extrabold text-evsathi-dark">
                        {booking.charger?.title || 'P2P Host Charger'}
                      </h3>
                      
                      {isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold border border-emerald-300 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-emerald-600 animate-pulse" /> Active Charging
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-evsathi-soft text-evsathi-dark text-[11px] font-extrabold border border-evsathi-mint">
                          Completed Session
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-extrabold border border-sky-300">
                          Confirmed Reserved
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-evsathi-slate flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-evsathi-teal shrink-0" />
                      {booking.charger?.location?.address || 'Residential Host'}, {booking.charger?.location?.city || 'Noida'}
                    </p>

                    {/* Key Session Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                      <div className="p-2.5 bg-evsathi-light rounded-xl border border-evsathi-soft">
                        <span className="text-evsathi-muted font-semibold block text-[10px]">Start Time</span>
                        <span className="font-extrabold text-evsathi-dark">{formatBookingDateTime(booking.startTime)}</span>
                      </div>

                      <div className="p-2.5 bg-evsathi-light rounded-xl border border-evsathi-soft">
                        <span className="text-evsathi-muted font-semibold block text-[10px]">End Time</span>
                        <span className="font-extrabold text-evsathi-dark">{formatBookingDateTime(booking.endTime)}</span>
                      </div>

                      <div className="p-2.5 bg-evsathi-light rounded-xl border border-evsathi-soft">
                        <span className="text-evsathi-muted font-semibold block text-[10px]">Power / Type</span>
                        <span className="font-extrabold text-evsathi-dark">{booking.charger?.powerOutput || 7.4} kW ({booking.charger?.chargerType || 'AC'})</span>
                      </div>

                      <div className="p-2.5 bg-evsathi-light rounded-xl border border-evsathi-soft">
                        <span className="text-evsathi-muted font-semibold block text-[10px]">Receipt No</span>
                        <span className="font-extrabold text-evsathi-teal">{booking.receiptId || `RZP-${booking._id?.slice(-5)}`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Pricing & Action Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 border-evsathi-soft/60 pt-4 lg:pt-0">
                    <div className="text-left lg:text-right">
                      <p className="text-2xl font-extrabold text-evsathi-teal">₹{booking.totalPrice}</p>
                      <p className="text-[11px] font-semibold text-evsathi-muted">Razorpay Paid</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMessageOwner(booking)}
                        disabled={chatLoadingId === booking._id}
                        className="px-3 py-2 rounded-xl bg-evsathi-light hover:bg-evsathi-soft text-evsathi-dark text-xs font-bold border border-evsathi-mint flex items-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-evsathi-teal" />
                        <span>Message Host</span>
                      </button>

                      {isCompleted && (
                        review ? (
                          <button
                            type="button"
                            onClick={() => openReviewModal(booking, 'edit')}
                            className="px-3 py-2 rounded-xl bg-evsathi-teal text-white text-xs font-bold hover:bg-[#547b71] transition-colors flex items-center gap-1"
                          >
                            <Star className="w-3.5 h-3.5 fill-current" /> Edit Review
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openReviewModal(booking, 'add')}
                            className="px-3 py-2 rounded-xl bg-evsathi-soft hover:bg-evsathi-mint text-evsathi-dark text-xs font-bold border border-evsathi-mint transition-colors flex items-center gap-1"
                          >
                            <Star className="w-3.5 h-3.5 text-evsathi-teal" /> Rate Host
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="text-center py-12 border-dashed border-2 border-evsathi-mint">
            <div className="w-12 h-12 rounded-2xl bg-evsathi-light text-evsathi-teal flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-evsathi-dark">No charging sessions found</h3>
            <p className="text-xs text-evsathi-slate max-w-sm mx-auto mt-1 mb-4">
              Explore nearby residential home chargers or business hosts to book your next slot.
            </p>
            <Link to="/chargers">
              <Button variant="primary">Browse P2P Chargers</Button>
            </Link>
          </Card>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal.open && reviewModal.booking && (
        <div className="fixed inset-0 bg-evsathi-dark/60 backdrop-blur-xs flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-evsathi-mint">
            <h3 className="text-lg font-extrabold text-evsathi-dark">
              {reviewModal.mode === 'edit' ? 'Edit Host Review' : 'Rate Your Host Experience'}
            </h3>
            <p className="text-xs text-evsathi-slate">{reviewModal.booking.charger.title}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">Rating Stars</label>
                <select
                  className="w-full px-3 py-2 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-bold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: e.target.value }))}
                >
                  <option value={5}>⭐⭐⭐⭐⭐ 5 - Excellent Host</option>
                  <option value={4}>⭐⭐⭐⭐ 4 - Very Good</option>
                  <option value={3}>⭐⭐⭐ 3 - Average</option>
                  <option value={2}>⭐⭐ 2 - Needs Improvement</option>
                  <option value={1}>⭐ 1 - Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">Comments & Feedback</label>
                <textarea
                  className="w-full px-3 py-2 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark placeholder-evsathi-muted focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  rows="3"
                  placeholder="Share details about driveway access, charging speed, and host hospitality..."
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                ></textarea>
              </div>

              {reviewError && (
                <p className="text-xs font-bold text-rose-600">{reviewError}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="w-1/2 py-2.5 rounded-xl border border-evsathi-mint text-evsathi-dark text-xs font-bold hover:bg-evsathi-light transition-colors"
                onClick={closeReviewModal}
                disabled={reviewSubmitting}
              >
                Cancel
              </button>
              <Button
                variant="primary"
                className="w-1/2 py-2.5 text-xs"
                onClick={submitReview}
                loading={reviewSubmitting}
              >
                {reviewSubmitting ? 'Saving...' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
