import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { chargerService } from '../services/chargerService.js';
import { getImageUrl } from '../utils/imageHelper.js';

const toDateOnlyKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStatusForToday = (charger) => {
  if (!charger?.isActive) {
    return 'Inactive';
  }

  const todayKey = toDateOnlyKey(new Date());
  if (!todayKey) {
    return 'Active';
  }

  const disableWindows = Array.isArray(charger?.disableWindows) ? charger.disableWindows : [];
  const isDisabledToday = disableWindows.some((window) => {
    if (!window?.active) return false;

    const startKey = toDateOnlyKey(window.startTime);
    const endKey = toDateOnlyKey(window.endTime);

    if (!startKey || !endKey) return false;
    return todayKey >= startKey && todayKey <= endKey;
  });

  return isDisabledToday ? 'Inactive' : 'Active';
};

const MyChargers = () => {
  const [chargers, setChargers] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disableModal, setDisableModal] = useState({ open: false, charger: null, step: 'choice', mode: null });
  const [tempRange, setTempRange] = useState({ startDate: '', endDate: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchChargers();
    fetchEarnings();
  }, []);

  const fetchChargers = async () => {
    try {
      const response = await chargerService.getMyChargers();
      const chargersResp = response.data?.chargers || response.data?.data?.chargers || [];
      setChargers(chargersResp);
    } catch (error) {
      console.error('Error fetching chargers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await chargerService.getMyEarningsSummary();
      setEarningsSummary(response.data);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const closeModal = () => {
    setDisableModal({ open: false, charger: null, step: 'choice', mode: null });
    setTempRange({ startDate: '', endDate: '' });
    setSubmitting(false);
  };

  const handleDisable = async () => {
    if (!disableModal.charger) return;
    const payload = { mode: disableModal.mode };

    if (disableModal.mode === 'temporary') {
      if (!tempRange.startDate || !tempRange.endDate) {
        alert('Please select start and end dates.');
        return;
      }
      payload.startDate = tempRange.startDate;
      payload.endDate = tempRange.endDate;
    }

    setSubmitting(true);
    try {
      await chargerService.disable(disableModal.charger._id, payload);

      if (disableModal.mode === 'permanent') {
        // Optimistically remove permanently disabled charger from local list
        setChargers((prev) => prev.filter((c) => c._id !== disableModal.charger._id));
      } else {
        await fetchChargers();
      }
      closeModal();
      alert(
        disableModal.mode === 'permanent'
          ? 'Charger disabled permanently.'
          : 'Charger disabled for the selected dates.'
      );
    } catch (error) {
      console.error('Error disabling charger:', error);
      alert(error.response?.data?.message || 'Failed to disable charger');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Chargers</h1>
          <Link to="/create-charger" className="btn btn-primary">
            List Charger
          </Link>
        </div>

        {/* Earnings Summary Cards */}
        {earningsSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-emerald-700 mb-1">Today's Earnings</p>
              <p className="text-3xl font-extrabold text-emerald-900">
                ₹{earningsSummary.todayEarnings || 0}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-blue-700 mb-1">Past 7 Days</p>
              <p className="text-3xl font-extrabold text-blue-900">
                ₹{earningsSummary.last7DaysEarnings || 0}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-purple-700 mb-1">Past 31 Days</p>
              <p className="text-3xl font-extrabold text-purple-900">
                ₹{earningsSummary.last31DaysEarnings || 0}
              </p>
            </div>
          </div>
        )}

        {chargers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chargers.map((charger) => {
              const status = getStatusForToday(charger);
              const isActiveToday = status === 'Active';
              
              // Find earnings for this charger
              const chargerEarnings = earningsSummary?.chargers?.find(
                c => String(c.chargerId) === String(charger._id)
              );

              return (
                <div key={charger._id} className="card">
                {charger.images && charger.images.length > 0 && (
                  <div className="relative h-48 mb-3 rounded-lg overflow-hidden">
                    <img
                      src={getImageUrl(charger.images[0])}
                      alt={charger.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                    {charger.images.length > 1 && (
                      <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        +{charger.images.length - 1} more
                      </span>
                    )}
                  </div>
                )}
                <Link
                  to={`/chargers/${charger._id}`}
                  className="text-xl font-semibold text-primary-600 hover:underline mb-2 block"
                >
                  {charger.title}
                </Link>
                <p className="text-gray-600 mb-2">
                  {charger.location.city}, {charger.location.state}
                </p>
                <p className="text-2xl font-bold text-primary-600 mb-2">
                  ${charger.pricePerHour}/hr
                </p>
                <p className="text-sm text-gray-500">
                  {charger.chargerType} • {charger.connectorType}
                </p>
                <p className="text-sm mt-2">
                  Status:{' '}
                  <span className={isActiveToday ? 'text-green-600' : 'text-red-600'}>
                    {status}
                  </span>
                </p>
                
                {/* Earnings Info */}
                {chargerEarnings && (
                  <div className="mt-3 space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Past 7 days:</span>
                        <span className="font-bold text-emerald-700">₹{chargerEarnings.last7DaysEarnings}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Total bookings:</span>
                        <span className="font-semibold text-slate-900">{chargerEarnings.bookingCount}</span>
                      </div>
                    </div>

                    {/* Recent Charging History */}
                    {chargerEarnings.recentBookings && chargerEarnings.recentBookings.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Recent Bookings
                        </p>
                        {chargerEarnings.recentBookings.map((booking, idx) => (
                          <div 
                            key={booking._id} 
                            className="p-2 bg-white border border-slate-200 rounded text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {booking.driverAvatar ? (
                                  <img 
                                    src={booking.driverAvatar} 
                                    alt={booking.driverName}
                                    className="w-5 h-5 rounded-full"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-primary-600">
                                      {booking.driverName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <span className="font-semibold text-slate-900">{booking.driverName}</span>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                booking.status === 'CONFIRMED' || booking.status === 'confirmed' 
                                  ? 'bg-green-100 text-green-700'
                                  : booking.status === 'ACTIVE' || booking.status === 'active'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {booking.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-600">
                              <span>
                                {new Date(booking.startTime).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className="font-bold text-emerald-600">₹{booking.totalPrice}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to={`/chargers/${charger._id}/edit`}
                    className="btn btn-primary text-center"
                  >
                    Edit Details
                  </Link>
                  <Link
                    to={`/chargers/${charger._id}/timeline`}
                    className="btn btn-secondary text-center"
                  >
                    📅 Timeline View
                  </Link>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    to={`/chargers/${charger._id}/edit-slots`}
                    className="btn btn-outline text-center text-sm"
                  >
                    Manage Slots
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline text-sm"
                    onClick={() =>
                      setDisableModal({ open: true, charger, step: 'choice', mode: null })
                    }
                  >
                    Disable
                  </button>
                </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No chargers listed yet</p>
            <Link to="/create-charger" className="btn btn-primary">
              List Your First Charger
            </Link>
          </div>
        )}
      </div>

      <DisableModal
        disableModal={disableModal}
        setDisableModal={setDisableModal}
        tempRange={tempRange}
        setTempRange={setTempRange}
        onClose={closeModal}
        onConfirm={() => handleDisable()}
        submitting={submitting}
      />
    </>
  );
};

const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
      <button className="absolute top-3 right-3 text-gray-500" onClick={onClose}>
        ×
      </button>
      {children}
    </div>
  </div>
);

const DisableModalContent = ({ state, tempRange, setTempRange, onClose, onConfirm, submitting }) => {
  if (!state.charger) return null;

  if (state.step === 'choice') {
    return (
      <>
        <h3 className="text-xl font-bold mb-4">Disable {state.charger.title}</h3>
        <p className="text-sm text-gray-600 mb-4">Choose how you want to disable this charger.</p>
        <div className="space-y-2">
          <button
            className="btn btn-secondary w-full"
            onClick={() => state.setStep?.('temporary') || null}
          >
            Disable Temporarily
          </button>
          <button
            className="btn btn-outline w-full"
            onClick={() => state.setStep?.('permanent') || null}
          >
            Disable Permanently
          </button>
        </div>
      </>
    );
  }

  if (state.step === 'permanent') {
    return (
      <>
        <h3 className="text-xl font-bold mb-4">Disable Permanently</h3>
        <p className="text-sm text-gray-700 mb-4">
          Are you sure? You will not be able to enable again and will need to list a new charger.
        </p>
        <div className="flex gap-3">
          <button className="btn w-1/2" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary w-1/2" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Disabling...' : 'Confirm'}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h3 className="text-xl font-bold mb-4">Disable Temporarily</h3>
      <p className="text-sm text-gray-700 mb-4">Select the start and end dates to disable this charger.</p>
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            className="input w-full"
            value={tempRange.startDate}
            onChange={(e) => setTempRange((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            className="input w-full"
            value={tempRange.endDate}
            onChange={(e) => setTempRange((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button className="btn w-1/2" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary w-1/2" onClick={onConfirm} disabled={submitting}>
          {submitting ? 'Disabling...' : 'Disable'}
        </button>
      </div>
    </>
  );
};

const DisableModal = ({ disableModal, setDisableModal, tempRange, setTempRange, onClose, onConfirm, submitting }) => {
  if (!disableModal.open) return null;

  const stateWithSetter = {
    ...disableModal,
    setStep: (step) => setDisableModal((prev) => ({ ...prev, step, mode: step === 'permanent' ? 'permanent' : 'temporary' })),
  };

  return (
    <Modal onClose={onClose}>
      <DisableModalContent
        state={stateWithSetter}
        tempRange={tempRange}
        setTempRange={setTempRange}
        onClose={onClose}
        onConfirm={onConfirm}
        submitting={submitting}
      />
    </Modal>
  );
};

export default MyChargers;

