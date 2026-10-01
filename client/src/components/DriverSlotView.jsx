import React, { useState, useEffect } from 'react';
import slotService from '../services/slotService';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import Button from './ui/Button';

/**
 * Driver-facing slot view component
 * Shows simple available/occupied status in Gantt chart format
 */
const DriverSlotView = ({ chargerId, onSlotSelect }) => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [endDate, setEndDate] = useState(startOfDay(addDays(new Date(), 3)));
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    loadSlots();
  }, [chargerId, startDate, endDate]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      const res = await slotService.getDriverSlots(
        chargerId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      setSlots(res.data.data.slots || []);
    } catch (error) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (days) => {
    setStartDate(startOfDay(new Date()));
    setEndDate(startOfDay(addDays(new Date(), days)));
  };

  const handleSlotClick = (slot) => {
    if (slot.isBookable) {
      setSelectedSlot(slot);
      if (onSlotSelect) {
        onSlotSelect(slot);
      }
    }
  };

  const getDaysArray = () => {
    const days = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      days.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    return days;
  };

  const getSlotsForDay = (day) => {
    return slots.filter((slot) => {
      const slotStart = new Date(slot.startTime);
      return isSameDay(slotStart, day);
    });
  };

  const getSlotPosition = (slot, day) => {
    const slotStart = new Date(slot.startTime);
    const slotEnd = new Date(slot.endTime);

    if (!isSameDay(slotStart, day)) {
      return null;
    }

    const startHour = slotStart.getHours() + slotStart.getMinutes() / 60;
    const endHour = slotEnd.getHours() + slotEnd.getMinutes() / 60;

    const top = (startHour / 24) * 100;
    const height = ((endHour - startHour) / 24) * 100;

    return { top: `${top}%`, height: `${height}%` };
  };

  const days = getDaysArray();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Available Time Slots</h3>
            <p className="text-sm text-slate-300 mt-1">
              {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleDateRangeChange(3)}
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-slate-700"
            >
              3 Days
            </Button>
            <Button
              onClick={() => handleDateRangeChange(7)}
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-slate-700"
            >
              7 Days
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-100 border-2 border-emerald-300 rounded"></div>
          <span className="text-sm text-slate-700">Available (Click to book)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-300 border-2 border-slate-400 rounded"></div>
          <span className="text-sm text-slate-700">Occupied</span>
        </div>
      </div>

      {/* Simple Timeline View */}
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full">
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r border-slate-200">
            <div className="h-12 border-b border-slate-200 bg-slate-100 flex items-center justify-center font-semibold text-xs">
              Time
            </div>
            <div className="relative" style={{ height: '480px' }}>
              {[6, 9, 12, 15, 18, 21].map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full border-b border-slate-200 text-xs text-slate-600 pl-1"
                  style={{
                    top: `${(hour / 24) * 100}%`,
                  }}
                >
                  {format(new Date().setHours(hour, 0, 0, 0), 'ha')}
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const daySlots = getSlotsForDay(day);

            return (
              <div key={dayIndex} className="flex-1 min-w-[120px] border-r border-slate-200">
                {/* Day header */}
                <div className="h-12 border-b border-slate-200 bg-slate-100 flex flex-col items-center justify-center">
                  <span className="text-sm font-semibold">{format(day, 'EEE')}</span>
                  <span className="text-xs text-slate-600">{format(day, 'MMM dd')}</span>
                </div>

                {/* Slots */}
                <div className="relative" style={{ height: '480px' }}>
                  {/* Grid lines */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-slate-100"
                      style={{
                        top: `${(hour / 24) * 100}%`,
                        height: `${(1 / 24) * 100}%`,
                      }}
                    />
                  ))}

                  {/* Render slots */}
                  {daySlots.map((slot) => {
                    const position = getSlotPosition(slot, day);
                    if (!position) return null;

                    const isAvailable = slot.status === 'available' && slot.isBookable;
                    const isSelected = selectedSlot?.id === slot.id;

                    return (
                      <div
                        key={slot.id}
                        className={`absolute left-1 right-1 rounded border-2 transition-all ${
                          isAvailable
                            ? `cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-200 border-emerald-500 shadow-lg z-10'
                                  : 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200 hover:shadow-md'
                              }`
                            : 'bg-slate-200 border-slate-400 cursor-not-allowed'
                        }`}
                        style={position}
                        onClick={() => handleSlotClick(slot)}
                      >
                        <div className="p-2 h-full flex flex-col justify-between text-xs">
                          <div className="font-semibold text-slate-800">
                            {format(new Date(slot.startTime), 'h:mm a')}
                          </div>
                          {isAvailable && (
                            <div className="text-[10px] font-bold text-emerald-700">
                              {slot.price ? `₹${slot.price}` : 'Available'}
                            </div>
                          )}
                          {!isAvailable && (
                            <div className="text-[10px] text-slate-600">Occupied</div>
                          )}
                          <div className="font-semibold text-slate-800">
                            {format(new Date(slot.endTime), 'h:mm a')}
                          </div>
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

      {/* Selected slot info */}
      {selectedSlot && (
        <div className="p-4 bg-emerald-50 border-t border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Selected Slot</p>
              <p className="text-sm text-slate-600">
                {format(new Date(selectedSlot.startTime), 'MMM dd, h:mm a')} -{' '}
                {format(new Date(selectedSlot.endTime), 'h:mm a')}
              </p>
            </div>
            {selectedSlot.price && (
              <div className="text-lg font-bold text-emerald-700">₹{selectedSlot.price}</div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {slots.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          <p className="text-lg font-medium">No slots available</p>
          <p className="text-sm mt-2">Please check back later or try a different date range</p>
        </div>
      )}
    </div>
  );
};

export default DriverSlotView;
