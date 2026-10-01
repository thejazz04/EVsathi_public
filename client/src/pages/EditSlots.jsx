import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chargerService } from '../services/chargerService.js';
import { slotService } from '../services/slotService.js';
import { Calendar, Clock, Save, X, Eye, List, DollarSign, TrendingUp, Plus, Sparkles } from 'lucide-react';

const EditSlots = () => {
  const { chargerId } = useParams();
  const navigate = useNavigate();
  const [charger, setCharger] = useState(null);
  const [slots, setSlots] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [earningsRange, setEarningsRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState(null);
  const [modifiedSlots, setModifiedSlots] = useState({});
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'list'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSlot, setNewSlot] = useState({
    startTime: '',
    endTime: '',
    price: '',
  });

  const statusStyles = {
    available: 'bg-green-100 text-green-800 border-green-300',
    booked: 'bg-blue-100 text-blue-800 border-blue-300',
    'in-use': 'bg-amber-100 text-amber-800 border-amber-300',
    completed: 'bg-gray-100 text-gray-800 border-gray-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
    blocked: 'bg-neutral-200 text-neutral-800 border-neutral-300',
  };

  useEffect(() => {
    fetchData();
    fetchEarnings();
  }, [chargerId]);

  useEffect(() => {
    fetchEarnings();
  }, [earningsRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const chargerResponse = await chargerService.getById(chargerId);
      setCharger(chargerResponse.data.charger);

      // Get slots for the next 30 days using the correct API
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const slotsResponse = await slotService.getHostSlots(chargerId, startDate, endDate);
      setSlots(slotsResponse.data?.slots || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load slot data');
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await chargerService.getChargerEarnings(chargerId, { range: earningsRange });
      setEarnings(response.data);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const handleEditClick = (slot) => {
    setEditingSlot({
      ...slot,
      startTime: new Date(slot.startTime).toISOString().slice(0, 16),
      endTime: new Date(slot.endTime).toISOString().slice(0, 16),
      price: slot.price,
      pricePerSlot: slot.price,
    });
  };

  const handleEditChange = (field, value) => {
    setEditingSlot({ ...editingSlot, [field]: value });
    setModifiedSlots({
      ...modifiedSlots,
      [editingSlot._id]: { ...editingSlot, [field]: value },
    });
  };

  const handleToggleStatus = (slotId, currentStatus) => {
    if (currentStatus === 'booked') {
      alert('Cannot change status of a booked slot');
      return;
    }

    if (!['available', 'blocked'].includes(currentStatus)) {
      alert('Only available or blocked slots can be toggled');
      return;
    }

    const newStatus = currentStatus === 'available' ? 'blocked' : 'available';
    const slot = slots.find((s) => s._id === slotId);
    
    setModifiedSlots({
      ...modifiedSlots,
      [slotId]: { ...slot, status: newStatus },
    });

    setSlots(
      slots.map((s) => (s._id === slotId ? { ...s, status: newStatus } : s))
    );
  };

  const handleDeleteSlot = async (slotId) => {
    const slot = slots.find((s) => s._id === slotId);
    if (slot.status === 'booked') {
      alert('Cannot delete a booked slot');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this slot?')) {
      return;
    }

    try {
      await slotService.deleteSlot(chargerId, slotId);
      setSlots(slots.filter((s) => s._id !== slotId));
      const newModified = { ...modifiedSlots };
      delete newModified[slotId];
      setModifiedSlots(newModified);
      alert('Slot deleted successfully');
    } catch (error) {
      alert(error.response?.data?.error?.message || 'Failed to delete slot');
    }
  };

  const handleSaveAll = async () => {
    try {
      const updatePromises = Object.keys(modifiedSlots).map(async (slotId) => {
        const modifiedSlot = modifiedSlots[slotId];
        await slotService.updateSlot(chargerId, slotId, {
          startTime: modifiedSlot.startTime,
          endTime: modifiedSlot.endTime,
          price: (modifiedSlot.price != null && modifiedSlot.price !== '') ? Number(modifiedSlot.price) : ((modifiedSlot.pricePerSlot != null && modifiedSlot.pricePerSlot !== '') ? Number(modifiedSlot.pricePerSlot) : undefined),
          status: modifiedSlot.status,
        });
      });

      await Promise.all(updatePromises);
      alert('All changes saved successfully');
      setModifiedSlots({});
      setEditingSlot(null);
      navigate('/my-chargers');
    } catch (error) {
      alert(error.response?.data?.error?.message || 'Failed to save changes');
    }
  };

  const handleCancel = () => {
    if (Object.keys(modifiedSlots).length > 0) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    navigate('/my-chargers');
  };

  const handleGenerateSlots = async () => {
    if (!window.confirm('Generate 2-hour persistent availability slots for the next 7 days based on station schedule?')) {
      return;
    }
    setGenerating(true);
    try {
      const res = await slotService.generateFromTemplate(chargerId, {
        startHour: 8,
        endHour: 20,
        slotDurationMinutes: 120,
        days: 7,
      });
      alert(res.message || 'Slots generated successfully!');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to generate slots');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateSingleSlot = async (e) => {
    e.preventDefault();
    if (!newSlot.startTime || !newSlot.endTime) {
      alert('Start and end times are required');
      return;
    }
    try {
      await slotService.createSlot(chargerId, {
        startTime: new Date(newSlot.startTime).toISOString(),
        endTime: new Date(newSlot.endTime).toISOString(),
        price: newSlot.price ? Number(newSlot.price) : undefined,
      });
      alert('Slot created successfully');
      setShowAddModal(false);
      setNewSlot({ startTime: '', endTime: '', price: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to create slot');
    }
  };

  // Generate hourly timeline slots for visualization
  const generateTimelineSlots = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dateSlots = slots.filter(slot => {
      const slotDate = new Date(slot.startTime).toISOString().split('T')[0];
      return slotDate === selectedDate;
    });

    return hours.map(hour => {
      const hourStart = new Date(`${selectedDate}T${String(hour).padStart(2, '0')}:00:00`);
      const hourEnd = new Date(`${selectedDate}T${String(hour).padStart(2, '0')}:59:59`);
      
      const overlappingSlots = dateSlots.filter(slot => {
        const slotStart = new Date(slot.startTime);
        const slotEnd = new Date(slot.endTime);
        return slotStart < hourEnd && slotEnd > hourStart;
      });

      return {
        hour,
        time: `${String(hour).padStart(2, '0')}:00`,
        slots: overlappingSlots
      };
    });
  };

  const timelineData = generateTimelineSlots();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!charger) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Charger not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Availability Slots</h1>
          <p className="text-gray-600">
            {charger.title} - {charger.location.city}, {charger.location.state}
          </p>
        </div>
        
        {/* Slot Actions & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateSlots}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Slots (7 Days)'}
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Slot
          </button>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === 'timeline' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-600'
              }`}
            >
              <Clock className="w-4 h-4" />
              Timeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Earnings Section */}
      {earnings && (
        <div className="mb-8 space-y-4">
          {/* Earnings Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-700 mb-1">Total Earnings</p>
                  <p className="text-3xl font-extrabold text-emerald-900">
                    ₹{earnings.totalEarnings || 0}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {earnings.range === 'today' && 'Today'}
                    {earnings.range === '7days' && 'Past 7 Days'}
                    {earnings.range === '31days' && 'Past 31 Days'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-emerald-600 opacity-50" />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-700 mb-1">Total Bookings</p>
                  <p className="text-3xl font-extrabold text-blue-900">
                    {earnings.totalBookings || 0}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Completed sessions</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-700 mb-1">Avg per Booking</p>
                  <p className="text-3xl font-extrabold text-purple-900">
                    ₹{earnings.totalBookings > 0 ? Math.round(earnings.totalEarnings / earnings.totalBookings) : 0}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">Average revenue</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </div>
          </div>

          {/* Range Selector & Daily Breakdown */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                Daily Earnings Timeline
              </h3>
              
              <select
                value={earningsRange}
                onChange={(e) => setEarningsRange(e.target.value)}
                className="input max-w-xs"
              >
                <option value="today">Today</option>
                <option value="7days">Past 7 Days</option>
                <option value="31days">Past 31 Days</option>
              </select>
            </div>

            {/* Daily Breakdown Chart */}
            {earnings.dailyBreakdown && earnings.dailyBreakdown.length > 0 ? (
              <div className="space-y-2">
                {earnings.dailyBreakdown.map((day) => {
                  const maxEarnings = Math.max(...earnings.dailyBreakdown.map(d => d.earnings), 1);
                  const percentage = (day.earnings / maxEarnings) * 100;
                  
                  return (
                    <div key={day.date} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </span>
                        <span className="font-bold text-emerald-700">₹{day.earnings}</span>
                      </div>
                      <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-end pr-3 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        >
                          {day.earnings > 0 && (
                            <span className="text-xs font-bold text-white">
                              {day.bookings} booking{day.bookings !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No earnings data for this period</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="mb-8 space-y-4">
          {/* Date Picker */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600" />
                Select Date to View:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input max-w-xs"
              />
            </div>
          </div>

          {/* Timeline Visualization */}
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              24-Hour Availability Timeline - {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>
            
            <div className="space-y-1 overflow-x-auto">
              {timelineData.map(({ hour, time, slots: hourSlots }) => (
                <div key={hour} className="flex items-center gap-2 min-w-[600px]">
                  {/* Time Label */}
                  <div className="w-16 text-sm font-mono text-gray-600 text-right flex-shrink-0">
                    {time}
                  </div>
                  
                  {/* Timeline Bar */}
                  <div className="flex-1 h-10 relative bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors">
                    {hourSlots.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                        Available
                      </div>
                    ) : (
                      hourSlots.map((slot) => {
                        const slotStart = new Date(slot.startTime);
                        const slotEnd = new Date(slot.endTime);
                        const hourStart = new Date(`${selectedDate}T${String(hour).padStart(2, '0')}:00:00`);
                        const hourEnd = new Date(`${selectedDate}T${String(hour + 1).padStart(2, '0')}:00:00`);
                        
                        // Calculate position and width as percentage
                        const startMinute = slotStart < hourStart ? 0 : slotStart.getMinutes();
                        const endMinute = slotEnd > hourEnd ? 60 : slotEnd.getMinutes();
                        const left = (startMinute / 60) * 100;
                        const width = ((endMinute - startMinute) / 60) * 100;
                        
                        const colors = {
                          available: 'bg-green-500 hover:bg-green-600',
                          booked: 'bg-blue-500 hover:bg-blue-600',
                          'in-use': 'bg-amber-500 hover:bg-amber-600',
                          completed: 'bg-gray-400 hover:bg-gray-500',
                          cancelled: 'bg-red-400 hover:bg-red-500',
                          blocked: 'bg-gray-600 hover:bg-gray-700',
                        };
                        
                        return (
                          <div
                            key={slot._id}
                            className={`absolute top-0.5 bottom-0.5 ${colors[slot.status]} rounded-sm shadow-sm cursor-pointer transition-all hover:shadow-md hover:z-10`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${slot.status.toUpperCase()}\n${new Date(slot.startTime).toLocaleTimeString()} - ${new Date(slot.endTime).toLocaleTimeString()}\nClick to edit`}
                            onClick={() => handleEditClick(slot)}
                          >
                            <div className="text-[10px] font-bold text-white px-1 truncate flex items-center h-full">
                              {slot.status}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="w-24 text-xs flex-shrink-0">
                    {hourSlots.length > 0 && (
                      <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                        statusStyles[hourSlots[0].status] || 'bg-gray-100'
                      }`}>
                        {hourSlots.length} slot{hourSlots.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-green-500 rounded shadow-sm"></div>
                <span className="font-medium">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-blue-500 rounded shadow-sm"></div>
                <span className="font-medium">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-amber-500 rounded shadow-sm"></div>
                <span className="font-medium">In-Use</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-gray-600 rounded shadow-sm"></div>
                <span className="font-medium">Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-gray-400 rounded shadow-sm"></div>
                <span className="font-medium">Completed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div>
          {slots.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 text-lg">No slots created yet</p>
              <p className="text-sm text-gray-400 mt-2">Slots will be created automatically when drivers book</p>
            </div>
          ) : (
            <div className="space-y-4">
              {slots.map((slot) => {
                const isEditing = editingSlot?._id === slot._id;
                const isModified = modifiedSlots[slot._id];

                return (
                  <div
                    key={slot._id}
                    className={`card ${isModified ? 'border-2 border-yellow-400' : ''}`}
                  >
                    {isEditing ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Start Time</label>
                            <input
                              type="datetime-local"
                              className="input"
                              value={editingSlot.startTime}
                              onChange={(e) => handleEditChange('startTime', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">End Time</label>
                            <input
                              type="datetime-local"
                              className="input"
                              value={editingSlot.endTime}
                              onChange={(e) => handleEditChange('endTime', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Price for Slot (optional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input"
                            value={editingSlot.price ?? editingSlot.pricePerSlot ?? ''}
                            onChange={(e) => {
                              handleEditChange('price', e.target.value);
                              handleEditChange('pricePerSlot', e.target.value);
                            }}
                            placeholder={`Default: ₹${charger.pricePerHour}/hr`}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingSlot(null);
                              if (!modifiedSlots[slot._id]) {
                                fetchData();
                              }
                            }}
                            className="btn btn-outline flex-1"
                          >
                            Cancel Edit
                          </button>
                          <button
                            onClick={() => setEditingSlot(null)}
                            className="btn btn-primary flex-1"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium border ${
                                  statusStyles[slot.status] || 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                              </span>
                              {isModified && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                                  Modified
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-lg">
                              {new Date(slot.startTime).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">
                              Ends: {new Date(slot.endTime).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">
                              Price:{' '}
                              {slot.pricePerSlot
                                ? `₹${slot.pricePerSlot}`
                                : `₹${charger.pricePerHour}/hr (default)`}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleEditClick(slot)}
                            className="btn btn-outline text-sm"
                            disabled={slot.status === 'booked'}
                          >
                            Edit Slot
                          </button>
                          <button
                            onClick={() => handleDeleteSlot(slot._id)}
                            className="btn btn-outline text-sm text-red-600 border-red-300 hover:bg-red-50"
                            disabled={slot.status === 'booked'}
                          >
                            Delete Slot
                          </button>
                          <button
                            onClick={() => handleToggleStatus(slot._id, slot.status)}
                            className={`btn text-sm ${
                              slot.status === 'available'
                                ? 'btn-outline border-gray-400'
                                : 'btn-primary'
                            }`}
                            disabled={slot.status === 'booked'}
                          >
                            {slot.status === 'available' ? 'Block Slot' : 'Enable Slot'}
                          </button>
                        </div>
                        {slot.status === 'booked' && (
                          <p className="text-xs text-blue-600 mt-2">
                            This slot is booked and cannot be modified
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <button onClick={handleCancel} className="btn btn-outline px-8 w-full sm:w-auto">
          <X className="w-4 h-4 inline mr-2" />
          Cancel
        </button>
        <button
          onClick={handleSaveAll}
          className="btn btn-primary px-8 w-full sm:w-auto"
          disabled={Object.keys(modifiedSlots).length === 0}
        >
          <Save className="w-4 h-4 inline mr-2" />
          Save Changes
          {Object.keys(modifiedSlots).length > 0 && (
            <span className="ml-2 bg-white text-primary-600 px-2 py-0.5 rounded-full text-xs font-bold">
              {Object.keys(modifiedSlots).length}
            </span>
          )}
        </button>
      </div>

      {Object.keys(modifiedSlots).length > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> You have {Object.keys(modifiedSlots).length} unsaved change(s).
            Click "Save Changes" to apply them.
          </p>
        </div>
      )}

      {/* Add Single Slot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Add Availability Slot</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSingleSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newSlot.startTime}
                  onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newSlot.endTime}
                  onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Price (₹) (Optional - defaults to ₹{charger.pricePerHour}/hr)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={`Default: ₹${charger.pricePerHour}`}
                  value={newSlot.price}
                  onChange={(e) => setNewSlot({ ...newSlot, price: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Create Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditSlots;
