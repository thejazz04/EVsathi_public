import React, { useState, useRef, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, Edit2, Trash2, X, Check } from 'lucide-react';

/**
 * InteractiveTimeline - 24-Hour Gantt Chart for Slot Booking
 * 
 * Features:
 * - Provider: Click-drag to block, edit/delete blocks, view bookings
 * - Consumer: View occupied slots, real-time booking validation
 * - Minute-level precision, 4-way overlap detection
 */
const InteractiveTimeline = ({
  date,
  slots = [],
  userRole = 'consumer', // 'provider' | 'consumer'
  pricePerHour = 25,
  onBlockSlot,
  onEditSlot,
  onDeleteSlot,
  onDateChange,
  loading = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [formData, setFormData] = useState({ startTime: '', endTime: '', reason: '', notes: '' });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);

  const timelineRef = useRef(null);
  const isProvider = userRole === 'provider' || userRole === 'host' || userRole === 'owner' || userRole === 'both';

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Calculate time from mouse X position
  const calculateTimeFromX = (clientX) => {
    if (!timelineRef.current) return null;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percent = (x / rect.width) * 100;
    const minutesFromMidnight = (percent / 100) * 24 * 60;
    
    // Round to nearest 15 minutes
    const roundedMinutes = Math.round(minutesFromMidnight / 15) * 15;
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    
    const time = new Date(date);
    time.setHours(hours, minutes, 0, 0);
    return time;
  };

  // Calculate X position percentage from time
  const timeToPercent = (time) => {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const timeDate = new Date(time);
    const minutesFromMidnight = (timeDate - dateStart) / (1000 * 60);
    return Math.max(0, Math.min(100, (minutesFromMidnight / (24 * 60)) * 100));
  };

  // Check for overlaps (4-way check)
  const checkOverlap = (newStart, newEnd, excludeId = null) => {
    const start = new Date(newStart);
    const end = new Date(newEnd);
    
    return slots.some(slot => {
      if (excludeId && slot.id === excludeId) return false;
      
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      
      return (
        (start < slotEnd && end > slotStart) ||
        (start >= slotStart && start < slotEnd) ||
        (end > slotStart && end <= slotEnd) ||
        (start <= slotStart && end >= slotEnd)
      );
    });
  };

  // Check if overlaps with bookings
  const overlapsBooking = (start, end) => {
    return slots.some(slot => {
      if (slot.status !== 'occupied') return false;
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      return (start < slotEnd && end > slotStart);
    });
  };

  // Mouse handlers for drag-to-block
  const handleMouseDown = (e) => {
    if (!isProvider || loading) return;
    
    const time = calculateTimeFromX(e.clientX);
    if (!time || time < new Date()) {
      setError('Cannot block past times');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setDragStart(time);
    setDragEnd(time);
    setIsDragging(true);
    setError('');
    setShowMenu(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return;
    const time = calculateTimeFromX(e.clientX);
    if (time) setDragEnd(time);
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      return;
    }

    const start = dragStart < dragEnd ? dragStart : dragEnd;
    const end = dragStart < dragEnd ? dragEnd : dragStart;
    const duration = (end - start) / (1000 * 60);
    
    // Minimum 15 minutes
    if (duration < 15) {
      setError('Minimum duration: 15 minutes');
      setTimeout(() => setError(''), 3000);
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    // Check booking overlap
    if (overlapsBooking(start, end)) {
      setError('Cannot block: overlaps with existing booking');
      setTimeout(() => setError(''), 3000);
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    // Open block form
    setFormData({
      startTime: start.toISOString().slice(0, 16),
      endTime: end.toISOString().slice(0, 16),
      reason: '',
      notes: '',
    });
    setShowBlockForm(true);
    setEditMode(false);
    setIsDragging(false);
  };

  const handleSlotClick = (slot, e) => {
    e.stopPropagation();
    if (!isProvider || slot.status === 'occupied') return;
    
    setSelectedSlot(slot);
    setShowMenu(true);
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
      await onDeleteSlot(selectedSlot.id);
      setShowMenu(false);
      setSelectedSlot(null);
    } catch (err) {
      setError(err.message || 'Failed to delete slot');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSaveBlock = async () => {
    try {
      const data = {
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        blockReason: formData.reason,
        notes: formData.notes,
      };

      if (editMode && selectedSlot) {
        await onEditSlot(selectedSlot.id, data);
      } else {
        await onBlockSlot(data);
      }
      
      setShowBlockForm(false);
      setEditMode(false);
      setSelectedSlot(null);
      setDragStart(null);
      setDragEnd(null);
      setFormData({ startTime: '', endTime: '', reason: '', notes: '' });
    } catch (err) {
      setError(err.message || 'Failed to save');
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Get today's slots
  const todaySlots = slots.filter(slot => {
    const slotDate = new Date(slot.startTime);
    const currentDate = new Date(date);
    return slotDate.toDateString() === currentDate.toDateString();
  });

  return (
    <div className="interactive-timeline bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6" />
            <div>
              <h3 className="text-lg font-bold">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-primary-100 mt-0.5">
                {isProvider ? 'Click and drag to block times • Click blocked slots to edit' : 'View available charging slots'}
              </p>
            </div>
          </div>
          {isProvider && (
            <div className="text-right">
              <div className="text-2xl font-bold">₹{pricePerHour}</div>
              <div className="text-xs text-primary-100">per hour</div>
            </div>
          )}
        </div>
      </div>

      {/* Date Navigation */}
      {onDateChange && (
        <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200">
          <button
            onClick={() => onDateChange(new Date(new Date(date).setDate(new Date(date).getDate() - 1)))}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            ← Previous Day
          </button>
          <button
            onClick={() => onDateChange(new Date())}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => onDateChange(new Date(new Date(date).setDate(new Date(date).getDate() + 1)))}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Next Day →
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded shadow-sm"></div>
          <span className="text-xs font-medium text-slate-700">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded shadow-sm"></div>
          <span className="text-xs font-medium text-slate-700">Occupied</span>
        </div>
        {isProvider && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-600 rounded shadow-sm"></div>
            <span className="text-xs font-medium text-slate-700">Blocked</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-sm font-medium text-red-700">{error}</span>
        </div>
      )}

      {/* Timeline */}
      <div className="p-4">
        {/* Hour markers */}
        <div className="flex items-center mb-2">
          <div className="w-16 flex-shrink-0"></div>
          <div className="flex-1 flex justify-between px-1">
            {[0, 6, 12, 18, 23].map(hour => (
              <div key={hour} className="text-xs font-semibold text-slate-600">
                {hour}:00
              </div>
            ))}
          </div>
        </div>

        {/* Timeline bar */}
        <div className="flex items-center">
          <div className="w-16 flex-shrink-0 text-sm font-bold text-slate-700">Timeline</div>
          <div
            ref={timelineRef}
            className={`flex-1 h-28 bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg relative border-2 ${
              isProvider && !loading ? 'border-primary-300 cursor-crosshair' : 'border-slate-300'
            } overflow-hidden shadow-inner`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDragging(false)}
          >
            {/* Hour grid lines */}
            {hours.map(hour => (
              <div
                key={hour}
                className="absolute top-0 bottom-0 w-px bg-slate-300"
                style={{ left: `${(hour / 24) * 100}%` }}
              />
            ))}

            {/* Current time indicator */}
            {new Date().toDateString() === new Date(date).toDateString() && (() => {
              const now = new Date();
              const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
              const percent = (minutesSinceMidnight / (24 * 60)) * 100;
              return (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20"
                  style={{ left: `${percent}%` }}
                >
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
              );
            })()}

            {/* Slot bars */}
            {todaySlots.map(slot => {
              const leftPos = timeToPercent(slot.startTime);
              const rightPos = timeToPercent(slot.endTime);
              const width = rightPos - leftPos;

              let bgColor, borderColor, textColor, hoverClass;
              
              if (slot.status === 'occupied' || (slot.status === 'blocked' && !isProvider)) {
                bgColor = 'bg-red-500';
                borderColor = 'border-red-600';
                textColor = 'text-white';
                hoverClass = 'hover:bg-red-600';
              } else if (slot.status === 'blocked' && isProvider) {
                bgColor = 'bg-gray-600';
                borderColor = 'border-gray-700';
                textColor = 'text-white';
                hoverClass = 'hover:bg-gray-700 cursor-pointer';
              } else {
                bgColor = 'bg-green-500';
                borderColor = 'border-green-600';
                textColor = 'text-white';
                hoverClass = 'hover:bg-green-600';
              }

              return (
                <div
                  key={slot.id}
                  className={`absolute top-2 bottom-2 ${bgColor} ${borderColor} border-2 rounded-md shadow-lg transition-all ${hoverClass} z-10`}
                  style={{ left: `${leftPos}%`, width: `${Math.max(width, 0.5)}%` }}
                  onClick={(e) => handleSlotClick(slot, e)}
                  title={`${slot.status.toUpperCase()}: ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}${
                    slot.blockReason ? `\nReason: ${slot.blockReason}` : ''
                  }`}
                >
                  {width > 3 && (
                    <div className={`h-full flex flex-col items-center justify-center ${textColor} px-1`}>
                      <div className="text-[10px] font-bold leading-tight">{formatTime(slot.startTime)}</div>
                      {width > 6 && <div className="text-[8px] opacity-90">{slot.status}</div>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Drag overlay */}
            {isDragging && dragStart && dragEnd && (
              <div
                className="absolute top-2 bottom-2 bg-blue-400 border-2 border-blue-600 rounded-md opacity-50 z-20"
                style={{
                  left: `${timeToPercent(dragStart < dragEnd ? dragStart : dragEnd)}%`,
                  width: `${Math.abs(timeToPercent(dragEnd) - timeToPercent(dragStart))}%`,
                }}
              />
            )}

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-30">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slot Menu (Edit/Delete) */}
      {showMenu && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 p-4" onClick={() => setShowMenu(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-4 w-64" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-sm mb-3">Blocked Slot</h4>
            <div className="text-xs text-slate-600 mb-3">
              <div>{formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</div>
              {selectedSlot.blockReason && <div className="mt-1">Reason: {selectedSlot.blockReason}</div>}
            </div>
            <div className="space-y-2">
              <button
                onClick={handleEditSlot}
                className="w-full flex items-center gap-2 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit Slot
              </button>
              <button
                onClick={handleDeleteSlot}
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete Slot
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Form Modal */}
      {showBlockForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowBlockForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{editMode ? 'Edit Blocked Slot' : 'Block Time Slot'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Maintenance, Personal use"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  placeholder="Additional details..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
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
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveBlock}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editMode ? 'Update' : 'Save Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveTimeline;
