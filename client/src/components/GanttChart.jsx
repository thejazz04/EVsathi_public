import React, { useState, useEffect } from 'react';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';

/**
 * GanttChart Component
 * Displays time slots in a timeline view (Gantt chart style)
 * 
 * Props:
 * - slots: Array of slot objects with startTime, endTime, status
 * - startDate: Start date for the chart
 * - endDate: End date for the chart
 * - onSlotClick: Callback when a slot is clicked
 * - editable: Whether slots are editable (host view)
 * - hourStart: Starting hour of day (default: 0)
 * - hourEnd: Ending hour of day (default: 24)
 */
const GanttChart = ({
  slots = [],
  startDate,
  endDate,
  onSlotClick,
  editable = false,
  hourStart = 0,
  hourEnd = 24,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState(null);

  // Generate array of dates between start and end
  const getDaysArray = () => {
    const days = [];
    let currentDate = startOfDay(new Date(startDate));
    const end = startOfDay(new Date(endDate));

    while (currentDate <= end) {
      days.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    return days;
  };

  const days = getDaysArray();
  const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => i + hourStart);

  // Get slot color based on status
  const getSlotColor = (status, isHovered = false) => {
    const colors = {
      available: isHovered ? 'bg-emerald-200 border-emerald-400' : 'bg-emerald-100 border-emerald-300',
      occupied: 'bg-rose-100 border-rose-300',
      blocked: 'bg-amber-100 border-amber-300',
    };
    return colors[status] || 'bg-gray-100 border-gray-300';
  };

  // Get slot label based on status
  const getSlotLabel = (status) => {
    const labels = {
      available: '✓ Available',
      occupied: '✕ Occupied',
      blocked: '⊗ Blocked',
    };
    return labels[status] || status;
  };

  // Calculate slot position in the grid
  const getSlotPosition = (slot, day) => {
    const slotStart = new Date(slot.startTime);
    const slotEnd = new Date(slot.endTime);

    if (!isSameDay(slotStart, day)) {
      return null; // Slot not on this day
    }

    const startHour = slotStart.getHours() + slotStart.getMinutes() / 60;
    const endHour = slotEnd.getHours() + slotEnd.getMinutes() / 60;

    // Calculate position within the visible hour range
    const top = ((startHour - hourStart) / (hourEnd - hourStart)) * 100;
    const height = ((endHour - startHour) / (hourEnd - hourStart)) * 100;

    return { top: `${top}%`, height: `${height}%` };
  };

  // Get slots for a specific day
  const getSlotsForDay = (day) => {
    return slots.filter((slot) => {
      const slotStart = new Date(slot.startTime);
      return isSameDay(slotStart, day);
    });
  };

  return (
    <div className="gantt-chart bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4">
        <h3 className="text-lg font-semibold">Slot Timeline</h3>
        <p className="text-sm text-slate-300 mt-1">
          {format(new Date(startDate), 'MMM dd, yyyy')} - {format(new Date(endDate), 'MMM dd, yyyy')}
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-100 border-2 border-emerald-300 rounded"></div>
          <span className="text-sm text-slate-700">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-rose-100 border-2 border-rose-300 rounded"></div>
          <span className="text-sm text-slate-700">Occupied</span>
        </div>
        {editable && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-100 border-2 border-amber-300 rounded"></div>
            <span className="text-sm text-slate-700">Blocked</span>
          </div>
        )}
      </div>

      {/* Gantt Chart Grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full">
          {/* Time column */}
          <div className="w-20 flex-shrink-0 border-r border-slate-200">
            <div className="h-12 border-b border-slate-200 bg-slate-100 flex items-center justify-center font-semibold text-sm">
              Time
            </div>
            <div className="relative" style={{ height: '600px' }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full border-b border-slate-200 flex items-start justify-center text-xs text-slate-600 pt-1"
                  style={{
                    top: `${((hour - hourStart) / (hourEnd - hourStart)) * 100}%`,
                    height: `${(1 / (hourEnd - hourStart)) * 100}%`,
                  }}
                >
                  {format(new Date().setHours(hour, 0, 0, 0), 'ha')}
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const daySlotsArray = getSlotsForDay(day);

            return (
              <div key={dayIndex} className="flex-1 min-w-[150px] border-r border-slate-200">
                {/* Day header */}
                <div className="h-12 border-b border-slate-200 bg-slate-100 flex flex-col items-center justify-center">
                  <span className="text-sm font-semibold">{format(day, 'EEE')}</span>
                  <span className="text-xs text-slate-600">{format(day, 'MMM dd')}</span>
                </div>

                {/* Slots for this day */}
                <div className="relative" style={{ height: '600px' }}>
                  {/* Hour grid lines */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-slate-200"
                      style={{
                        top: `${((hour - hourStart) / (hourEnd - hourStart)) * 100}%`,
                        height: `${(1 / (hourEnd - hourStart)) * 100}%`,
                      }}
                    />
                  ))}

                  {/* Render slots */}
                  {daySlotsArray.map((slot) => {
                    const position = getSlotPosition(slot, day);
                    if (!position) return null;

                    const isHovered = hoveredSlot === slot.id;

                    return (
                      <div
                        key={slot.id}
                        className={`absolute left-1 right-1 rounded border-2 transition-all cursor-pointer ${getSlotColor(
                          slot.status,
                          isHovered
                        )} ${isHovered ? 'shadow-lg z-10 scale-105' : 'shadow'}`}
                        style={position}
                        onClick={() => onSlotClick && onSlotClick(slot)}
                        onMouseEnter={() => setHoveredSlot(slot.id)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        <div className="p-2 h-full flex flex-col justify-between text-xs">
                          <div className="font-semibold text-slate-800">
                            {format(new Date(slot.startTime), 'h:mm a')}
                          </div>
                          <div className="text-[10px] text-slate-600">{getSlotLabel(slot.status)}</div>
                          <div className="font-semibold text-slate-800">
                            {format(new Date(slot.endTime), 'h:mm a')}
                          </div>
                          {slot.price && (
                            <div className="text-[10px] font-bold text-emerald-700">₹{slot.price}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {slots.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          <p className="text-lg font-medium">No slots available</p>
          <p className="text-sm mt-2">
            {editable ? 'Create slots to manage availability' : 'Check back later for available time slots'}
          </p>
        </div>
      )}
    </div>
  );
};

export default GanttChart;
