import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chargerService } from '../services/chargerService';
import slotService from '../services/slotService';
import api from '../services/api';
import { ArrowLeft, DollarSign, Zap, MapPin, CheckCircle2 } from 'lucide-react';

/**
 * SlotTimeline - Provider View for Managing Availability
 * Interactive Gantt chart with drag-to-block functionality
 */
const SlotTimeline = () => {
  const { chargerId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [charger, setCharger] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Initialize to today's date in local timezone
    const today = new Date();
    console.log('Initializing selectedDate to:', today.toLocaleDateString());
    return today;
  });
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [formData, setFormData] = useState({ startTime: '', endTime: '', reason: '', notes: '' });
  const [editMode, setEditMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    
    // Log API configuration for debugging
    console.log('API Configuration:', {
      baseURL: api.defaults.baseURL,
      timeout: api.defaults.timeout,
      chargerId
    });
  }, [chargerId, selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load charger details
      const chargerRes = await chargerService.getById(chargerId);
      setCharger(chargerRes.data.charger);

      // Load slots for selected date (get range: date to date+1)
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('Loading slots for date range:', { 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString() 
      });

      const slotsRes = await slotService.getHostSlots(
        chargerId,
        startDate.toISOString(),
        endDate.toISOString()
      );

      const loadedSlots = slotsRes.data?.data?.slots || slotsRes.data?.slots || [];
      console.log('Loaded slots:', loadedSlots.length, loadedSlots);
      
      setSlots(loadedSlots);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.error?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockSlot = async (data) => {
    try {
      console.log('handleBlockSlot called with:', { chargerId, data }); // Debug
      
      // Increase timeout for this specific request
      const response = await api.post(`/slots/host/${chargerId}/block`, data, {
        timeout: 30000, // 30 seconds
      });
      
      console.log('Block response:', response); // Debug
      await loadData(); // Refresh
      return response;
    } catch (err) {
      console.error('Block slot error:', err.response?.data || err); // Debug
      
      if (err.code === 'ECONNABORTED') {
        throw new Error('Server timeout - please check if backend is running');
      }
      
      throw new Error(err.response?.data?.error?.message || err.message || 'Failed to block slot');
    }
  };

  const handleUpdateSlot = async (slotId, data) => {
    try {
      console.log('handleUpdateSlot called with:', { slotId, data }); // Debug
      const response = await slotService.updateBlockedSlot(slotId, data);
      console.log('Update response:', response); // Debug
      await loadData(); // Refresh
      return response;
    } catch (err) {
      console.error('Update slot error:', err.response?.data || err); // Debug
      throw new Error(err.response?.data?.error?.message || err.message || 'Failed to update slot');
    }
  };

  const handleRemoveSlot = async (slotId) => {
    try {
      console.log('handleRemoveSlot called with:', { slotId }); // Debug
      const response = await slotService.unblockTimeSlot(slotId);
      console.log('Delete response:', response); // Debug
      await loadData(); // Refresh
      return response;
    } catch (err) {
      console.error('Delete slot error:', err.response?.data || err); // Debug
      throw new Error(err.response?.data?.error?.message || err.message || 'Failed to delete slot');
    }
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  // Calculate time from mouse X position
  const calculateTimeFromX = (clientX, element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percent = (x / rect.width) * 100;
    const minutesFromMidnight = (percent / 100) * 24 * 60;
    const roundedMinutes = Math.round(minutesFromMidnight / 15) * 15;
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    
    // Create time on the selected date with proper timezone handling
    const time = new Date(selectedDate);
    time.setHours(hours, minutes, 0, 0);
    
    console.log('calculateTimeFromX:', { x, percent, minutesFromMidnight, roundedMinutes, hours, minutes, time: time.toISOString() });
    
    return time;
  };

  const handleMouseDown = (e) => {
    console.log('Mouse down event triggered', e.target);
    
    // Ignore clicks on slot bars (elements with class containing 'slot' or inside .group)
    if (e.target.closest('.group')) {
      console.log('Clicked on a slot bar, ignoring');
      return;
    }
    
    const time = calculateTimeFromX(e.clientX, e.currentTarget);
    console.log('Calculated time from mouse position:', time);
    
    if (!time) {
      console.log('Could not calculate time, aborting');
      return;
    }
    
    console.log('Setting drag start:', time.toISOString());
    setDragStart(time);
    setDragEnd(time);
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return;
    
    // Get the drag container element
    const container = e.currentTarget;
    const time = calculateTimeFromX(e.clientX, container);
    
    if (time) {
      console.log('Dragging to:', time.toISOString());
      setDragEnd(time);
    }
  };

  const handleMouseUp = (e) => {
    console.log('Mouse up event triggered', { isDragging, dragStart, dragEnd });
    
    if (!isDragging || !dragStart || !dragEnd) {
      console.log('Not in drag mode, resetting');
      setIsDragging(false);
      return;
    }

    const start = dragStart < dragEnd ? dragStart : dragEnd;
    const end = dragStart < dragEnd ? dragEnd : dragStart;
    const duration = (end - start) / (1000 * 60);

    console.log('Mouse up - drag times:', { 
      dragStart: dragStart?.toISOString(), 
      dragEnd: dragEnd?.toISOString(),
      start: start.toISOString(), 
      end: end.toISOString(), 
      duration 
    });

    if (duration < 15) {
      alert('Minimum block duration is 15 minutes. Please drag for at least 15 minutes.');
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    // Use local time, not UTC
    const formatForInput = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const startStr = formatForInput(start);
    const endStr = formatForInput(end);
    
    console.log('Setting form data:', { startStr, endStr }); // Debug log
    
    setFormData({
      startTime: startStr,
      endTime: endStr,
      reason: '',
      notes: '',
    });
    setShowBlockForm(true);
    setEditMode(false);
    setIsDragging(false);
    // Don't clear dragStart/dragEnd yet - keep them for debugging
  };

  const handleEditSlot = () => {
    if (!selectedSlot) return;
    setFormData({
      startTime: new Date(selectedSlot.startTime).toISOString().slice(0, 16),
      endTime: new Date(selectedSlot.endTime).toISOString().slice(0, 16),
      reason: selectedSlot.blockReason || '',
      notes: selectedSlot.notes || '',
    });
    setEditMode(true);
    setShowBlockForm(true);
    setShowMenu(false);
  };

  const handleDeleteSlot = async () => {
    if (!selectedSlot || !window.confirm('Delete this blocked slot?')) {
      setShowMenu(false);
      return;
    }
    try {
      await handleRemoveSlot(selectedSlot._id);
      setShowMenu(false);
      setSelectedSlot(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleSaveBlock = async () => {
    if (saving) return; // Prevent double clicks
    
    try {
      setSaving(true);
      console.log('Saving block with formData:', formData); // Debug log
      
      if (!formData.startTime || !formData.endTime) {
        alert('Please select both start and end times');
        setSaving(false);
        return;
      }

      const data = {
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        blockReason: formData.reason || 'Blocked by host',
        notes: formData.notes || '',
      };

      console.log('Sending data to API:', data); // Debug log
      console.log('Backend should be running at:', api.defaults.baseURL); // Debug

      if (editMode && selectedSlot) {
        console.log('Updating slot:', selectedSlot._id); // Debug log
        await handleUpdateSlot(selectedSlot._id, data);
        alert('✅ Block updated successfully!');
      } else {
        console.log('Creating new block for charger:', chargerId); // Debug log
        await handleBlockSlot(data);
        alert('✅ Time blocked successfully! The timeline will refresh.');
      }

      // Close modal and reset
      setShowBlockForm(false);
      setEditMode(false);
      setSelectedSlot(null);
      setDragStart(null);
      setDragEnd(null);
      setFormData({ startTime: '', endTime: '', reason: '', notes: '' });
      
      // Reload data to show new block
      console.log('Reloading slots...'); // Debug
      await loadData();
      console.log('Slots reloaded successfully'); // Debug
    } catch (err) {
      console.error('Save error:', err);
      let errorMsg = '❌ Failed to save: ';
      
      if (err.message.includes('timeout')) {
        errorMsg += 'Backend server is not responding. Please check if the server is running on port 5001.';
      } else {
        errorMsg += err.message || 'Unknown error';
      }
      
      alert(`${errorMsg}\n\nCheck console (F12) for more details.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !charger) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading charger details...</p>
        </div>
      </div>
    );
  }

  if (error && !charger) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate('/my-chargers')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to My Chargers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-chargers')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back to My Chargers</span>
          </button>

          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{charger?.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{charger?.location?.city}, {charger?.location?.state}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span>{charger?.powerOutput} kW • {charger?.connectorType}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-semibold text-primary-600">₹{charger?.pricePerHour}/hour</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border-2 border-blue-300 rounded-xl p-5 mb-6 shadow-sm">
          <h3 className="font-bold text-blue-900 mb-3 text-lg flex items-center gap-2">
            📋 How to Use This Timeline
          </h3>
          
          {/* Server Status */}
          <div className="mb-3 p-2 bg-green-50 border border-green-300 rounded text-xs text-green-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="font-semibold">Backend server is running on port 5000 - Ready to save blocks!</span>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-3 border border-red-300">
              <div className="font-bold text-red-900 mb-1">🔴 Red Bars</div>
              <p className="text-slate-700">Confirmed bookings — cannot overlap</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-300">
              <div className="font-bold text-gray-900 mb-1">⬜ Gray Bars</div>
              <p className="text-slate-700">Your blocks — <strong>click to edit/delete</strong></p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-emerald-300">
              <div className="font-bold text-emerald-900 mb-1">🟢 Green Areas</div>
              <p className="text-slate-700">Available — <strong>click & drag to block</strong></p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-900">
            <strong>💡 Quick Tip:</strong> Drag horizontally on empty green areas to select times. Red bars show existing bookings that cannot be overlapped. The system will prevent overlapping blocks.
          </div>
        </div>

        {/* Unified Enhanced Gantt Chart with Blocking */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Daily Schedule - {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 mr-2">Selected: {selectedDate.toLocaleDateString()}</span>
              <button
                onClick={() => handleDateChange(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1)))}
                className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => handleDateChange(new Date())}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => handleDateChange(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1)))}
                className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Time Ruler */}
          <div className="relative mb-3">
            <div className="flex justify-between text-xs text-slate-600 font-mono px-1 font-semibold">
              {Array.from({ length: 13 }, (_, i) => i * 2).map(i => (
                <span key={i}>
                  {String(i).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            <div className="h-2 bg-gradient-to-r from-green-100 via-emerald-100 to-green-100 rounded-full mt-2 border border-slate-200"></div>
          </div>

          {/* READ-ONLY VISUAL TIMELINE - Shows all bookings and blocks */}
          <div className="mb-4 bg-white rounded-xl border-2 border-slate-300 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-700">📊 Current Schedule Overview</h4>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    console.log('Manual refresh clicked');
                    loadData();
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600"
                >
                  🔄 Refresh
                </button>
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-red-600">{slots.filter(s => s.status === 'occupied').length} Booked</span>
                  {' • '}
                  <span className="font-semibold text-gray-600">{slots.filter(s => s.status === 'blocked').length} Blocked</span>
                </div>
              </div>
            </div>
            
            {/* Visual Timeline Bar */}
            <div className="relative h-16 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-slate-300">
              
              {/* Time grid lines */}
              {Array.from({ length: 12 }, (_, i) => (i + 1) * 2).map(hour => (
                <div
                  key={hour}
                  className="absolute top-0 bottom-0 w-px bg-slate-200"
                  style={{ left: `${(hour / 24) * 100}%` }}
                />
              ))}

              {/* Empty state */}
              {slots.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                  <div className="text-center">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-400" />
                    <p className="font-semibold">No bookings or blocks</p>
                  </div>
                </div>
              )}

              {/* All slots displayed as horizontal bars */}
              {console.log('Rendering slots in visual timeline:', slots)}
              {slots.map((slot, index) => {
                const slotStart = new Date(slot.startTime);
                const slotEnd = new Date(slot.endTime);
                
                console.log(`Slot ${index}:`, {
                  id: slot._id || slot.id,
                  status: slot.status,
                  start: slotStart.toISOString(),
                  end: slotEnd.toISOString()
                });
                
                const startMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
                const endMinutes = slotEnd.getHours() * 60 + slotEnd.getMinutes();
                const left = (startMinutes / (24 * 60)) * 100;
                const width = ((endMinutes - startMinutes) / (24 * 60)) * 100;
                
                console.log(`Slot ${index} position:`, { left, width, startMinutes, endMinutes });
                
                const durationHours = ((slotEnd - slotStart) / (1000 * 60 * 60)).toFixed(1);
                const isOccupied = slot.status === 'occupied';
                const isBlocked = slot.status === 'blocked';
                const isAvailable = slot.status === 'available';

                // Skip rendering available slots in the visual timeline
                // Available slots are shown as empty green space
                if (isAvailable) {
                  return null;
                }

                // Stack in two rows
                const topOffset = (index % 2 === 0) ? 4 : 32;

                return (
                  <div
                    key={slot._id || slot.id}
                    className="absolute group"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 2)}%`,
                      minWidth: '50px',
                      top: `${topOffset}px`,
                      height: '26px',
                      zIndex: 20,
                      border: '2px solid yellow' // DEBUG BORDER
                    }}
                  >
                    <div
                      className={`w-full h-full rounded shadow-lg border-3 transition-all ${
                        isOccupied
                          ? 'bg-red-600 border-red-900 cursor-default'
                          : 'bg-gray-700 border-gray-900 cursor-pointer hover:bg-gray-800 hover:shadow-xl hover:scale-105'
                      }`}
                      onClick={() => {
                        if (isBlocked) {
                          setSelectedSlot(slot);
                          setShowMenu(true);
                        } else if (isOccupied) {
                          // Show info that this is a driver booking
                          alert('This slot is booked by a driver and cannot be edited.');
                        }
                      }}
                    >
                      <div className="flex items-center justify-center h-full px-2 text-white text-xs font-bold">
                        <span className="truncate">
                          {isOccupied ? '🔴' : '⬜'} {slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </div>

                    {/* Tooltip */}
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-slate-900 text-white px-3 py-2 rounded shadow-xl z-50 text-xs whitespace-nowrap">
                      <div className="font-bold">{isOccupied ? '🔴 BOOKED BY DRIVER' : '⬜ BLOCKED BY HOST'}</div>
                      <div className="text-slate-300 mt-1">
                        {slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {slotEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                      <div className="text-slate-300">Duration: {durationHours}h</div>
                      {isBlocked && <div className="text-yellow-300 mt-1">👆 Click to edit/delete</div>}
                      {isOccupied && <div className="text-red-300 mt-1">Cannot be edited</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 bg-red-500 border border-red-700 rounded"></div>
                <span className="text-slate-600">Booked by Driver</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 bg-gray-600 border border-gray-800 rounded"></div>
                <span className="text-slate-600">Blocked by You</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 bg-green-50 border border-green-300 rounded"></div>
                <span className="text-slate-600">Available</span>
              </div>
            </div>
          </div>

          {/* INTERACTIVE DRAG-TO-BLOCK AREA */}
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-blue-900 mb-1">✏️ Block New Times</h4>
                <p className="text-xs text-blue-800">Drag horizontally on the green area below OR click the button</p>
              </div>
              <button
                onClick={() => {
                  // Open form with empty times for manual entry
                  const now = new Date(selectedDate);
                  now.setHours(8, 0, 0, 0);
                  const later = new Date(selectedDate);
                  later.setHours(10, 0, 0, 0);
                  
                  const formatForInput = (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                  };
                  
                  setFormData({
                    startTime: formatForInput(now),
                    endTime: formatForInput(later),
                    reason: '',
                    notes: '',
                  });
                  setEditMode(false);
                  setShowBlockForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold"
              >
                ➕ Add Block Manually
              </button>
            </div>
          </div>

          {/* Interactive Timeline Container */}
          <div className="relative">
            {/* Main Timeline Track - For dragging only */}
            <div 
              className="relative h-20 bg-gradient-to-r from-emerald-100 via-green-100 to-emerald-100 rounded-lg border-2 border-emerald-500 select-none cursor-crosshair hover:bg-emerald-200 transition-colors"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (isDragging) {
                  setIsDragging(false);
                  setDragStart(null);
                  setDragEnd(null);
                }
              }}
            >
              {/* Helper text when empty */}
              {!isDragging && (
                <div className="absolute inset-0 flex items-center justify-center text-emerald-700 text-sm pointer-events-none">
                  <div className="text-center">
                    <p className="font-bold">👆 Click and Drag Here to Block Times</p>
                    <p className="text-xs mt-1">Drag horizontally to select start and end times</p>
                  </div>
                </div>
              )}

              {/* Dragging preview overlay */}
              {isDragging && dragStart && dragEnd && (() => {
                const start = dragStart < dragEnd ? dragStart : dragEnd;
                const end = dragStart < dragEnd ? dragEnd : dragStart;
                
                const startMinutes = start.getHours() * 60 + start.getMinutes();
                const endMinutes = end.getHours() * 60 + end.getMinutes();
                const left = (startMinutes / (24 * 60)) * 100;
                const width = ((endMinutes - startMinutes) / (24 * 60)) * 100;
                const duration = ((end - start) / (1000 * 60)).toFixed(0);
                
                return (
                  <div 
                    className="absolute pointer-events-none"
                    style={{ 
                      left: `${left}%`, 
                      width: `${width}%`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: '40px',
                      zIndex: 40
                    }}
                  >
                    <div className="w-full h-full bg-blue-500 border-3 border-blue-700 rounded-lg shadow-2xl flex flex-col items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        ⏱️ Blocking {duration} minutes
                      </span>
                      <span className="text-white text-[10px] mt-0.5">
                        {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-200 flex gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-4 bg-red-500 rounded border-2 border-red-600"></div>
              <span className="text-slate-700 font-medium">Occupied (Booked)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-4 bg-gray-600 rounded border-2 border-gray-700"></div>
              <span className="text-slate-700 font-medium">Blocked by You (Click to edit)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-4 bg-slate-50 rounded border-2 border-slate-300"></div>
              <span className="text-slate-700 font-medium">Available (Drag to block)</span>
            </div>
          </div>
        </div>

        {/* Block Form Modal */}
        {showBlockForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => {
            setShowBlockForm(false);
            setEditMode(false);
            setSelectedSlot(null);
            setDragStart(null);
            setDragEnd(null);
          }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-2xl font-bold text-slate-900">
                  {editMode ? '✏️ Edit Blocked Time' : '🚫 Block Time Slot'}
                </h3>
                <button
                  onClick={() => {
                    setShowBlockForm(false);
                    setEditMode(false);
                    setSelectedSlot(null);
                    setDragStart(null);
                    setDragEnd(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-sm text-blue-800">
                <strong>ℹ️ Selected Time Range:</strong> 
                {formData.startTime && formData.endTime ? (
                  <div className="mt-2 space-y-1">
                    <div className="font-bold text-base">
                      {new Date(formData.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} 
                      {' → '}
                      {new Date(formData.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      {' '}({Math.round((new Date(formData.endTime) - new Date(formData.startTime)) / (1000 * 60))} minutes)
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Start: {formData.startTime} | End: {formData.endTime}
                    </div>
                  </div>
                ) : (
                  <span className="ml-2">Review the times below and add optional details, then click <strong>Confirm Block</strong> to save.</span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    🕐 Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base font-medium"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    🕐 End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base font-medium"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    📝 Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Maintenance, Personal use, Repairs"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    💬 Notes (Optional)
                  </label>
                  <textarea
                    placeholder="Additional details..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowBlockForm(false);
                    setEditMode(false);
                    setSelectedSlot(null);
                    setDragStart(null);
                    setDragEnd(null);
                  }}
                  className="flex-1 px-5 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-base border-2 border-slate-300"
                >
                  ❌ Cancel
                </button>
                <button
                  onClick={handleSaveBlock}
                  disabled={saving || !formData.startTime || !formData.endTime}
                  className={`flex-1 px-5 py-3 rounded-lg transition-all font-bold text-base shadow-lg ${
                    saving || !formData.startTime || !formData.endTime
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 hover:shadow-xl'
                  }`}
                >
                  {saving ? '⏳ Saving...' : `✅ ${editMode ? 'Update Block' : 'Confirm Block'}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit/Delete Menu Modal */}
        {showMenu && selectedSlot && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-5 w-80 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <h4 className="font-bold text-lg mb-3 text-slate-900">⬜ Blocked Time Slot</h4>
              <div className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-800">🕐 Time:</div>
                <div className="mt-1">{new Date(selectedSlot.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedSlot.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                {selectedSlot.blockReason && (
                  <>
                    <div className="font-semibold text-slate-800 mt-2">📝 Reason:</div>
                    <div className="mt-1">{selectedSlot.blockReason}</div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <button
                  onClick={handleEditSlot}
                  className="w-full px-4 py-3 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-bold border-2 border-primary-200"
                >
                  ✏️ Edit This Block
                </button>
                <button
                  onClick={handleDeleteSlot}
                  className="w-full px-4 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-bold border-2 border-red-200"
                >
                  🗑️ Delete This Block
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-semibold"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slot Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Total Slots</div>
            <div className="text-2xl font-bold text-slate-900">{slots.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Occupied</div>
            <div className="text-2xl font-bold text-red-600">
              {slots.filter(s => s.status === 'occupied').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Blocked by You</div>
            <div className="text-2xl font-bold text-gray-600">
              {slots.filter(s => s.status === 'blocked').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlotTimeline;
