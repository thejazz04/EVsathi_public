import Slot from '../models/Slot.js';
import Charger from '../models/Charger.js';
import Booking from '../models/Booking.js';
import mongoose from 'mongoose';

/**
 * HOST: Get Gantt chart data for a charger
 * Shows all slots: available, blocked, occupied
 */
export const getHostSlots = async (req, res, next) => {
  try {
    const { chargerId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify charger exists and user is the owner
    const charger = await Charger.findById(chargerId);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'CHARGER_NOT_FOUND', message: 'Charger not found' },
      });
    }

    if (charger.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own this charger' },
      });
    }

    // Default to next 7 days if not specified
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const ganttData = await Slot.getGanttChartData(chargerId, start, end);

    res.status(200).json({
      success: true,
      data: {
        charger: {
          id: charger._id,
          title: charger.title,
          pricePerHour: charger.pricePerHour,
        },
        dateRange: { start, end },
        slots: ganttData,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DRIVER: Get available slots for a charger (read-only Gantt view)
 * Shows only: available (green) and occupied (red)
 * Blocked slots appear as occupied to drivers
 */
export const getDriverSlots = async (req, res, next) => {
  try {
    const { chargerId } = req.params;
    const { startDate, endDate } = req.query;

    const charger = await Charger.findById(chargerId);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'CHARGER_NOT_FOUND', message: 'Charger not found' },
      });
    }

    // Default to next 7 days
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const allSlots = await Slot.find({
      charger: chargerId,
      startTime: { $lt: end },
      endTime: { $gt: start },
    }).sort({ startTime: 1 });

    // Transform for driver view: blocked → occupied
    const driverSlots = allSlots.map((slot) => ({
      id: slot._id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status === 'blocked' ? 'occupied' : slot.status, // Hide blocked from drivers
      price: slot.price,
      isBookable: slot.status === 'available',
    }));

    res.status(200).json({
      success: true,
      data: {
        charger: {
          id: charger._id,
          title: charger.title,
          pricePerHour: charger.pricePerHour,
        },
        dateRange: { start, end },
        slots: driverSlots,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * HOST: Block a time range (create blocked slot)
 * Prevents overlapping with existing slots
 */
export const blockTimeSlot = async (req, res, next) => {
  try {
    const { chargerId } = req.params;
    const { startTime, endTime, blockReason, notes } = req.body;

    // Validate inputs
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Start time and end time are required' },
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIME_RANGE', message: 'End time must be after start time' },
      });
    }

    // Verify charger ownership
    const charger = await Charger.findById(chargerId);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'CHARGER_NOT_FOUND', message: 'Charger not found' },
      });
    }

    if (charger.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own this charger' },
      });
    }

    // Check for overlapping slots (any status)
    const overlap = await Slot.findOne({
      charger: chargerId,
      $or: [
        { startTime: { $lt: end }, endTime: { $gt: start } },
        { startTime: { $gte: start }, endTime: { $lte: end } },
        { startTime: { $lte: start }, endTime: { $gte: end } },
      ],
    });

    if (overlap) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLOT_OVERLAP',
          message: 'Time range overlaps with an existing slot',
          existingSlot: {
            id: overlap._id,
            startTime: overlap.startTime,
            endTime: overlap.endTime,
            status: overlap.status,
          },
        },
      });
    }

    // Create blocked slot
    const blockedSlot = await Slot.create({
      charger: chargerId,
      startTime: start,
      endTime: end,
      price: charger.pricePerHour || 25,
      status: 'blocked',
      blockedBy: req.user._id,
      blockReason: blockReason || '',
      notes: notes || '',
    });

    res.status(201).json({
      success: true,
      data: {
        slot: blockedSlot,
        message: 'Time slot blocked successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * HOST: Unblock a time slot (delete blocked slot)
 * Only works for blocked slots, not occupied ones
 */
export const unblockTimeSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;

    const slot = await Slot.findById(slotId).populate('charger', 'owner');
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: { code: 'SLOT_NOT_FOUND', message: 'Slot not found' },
      });
    }

    // Verify ownership
    if (slot.charger.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own this charger' },
      });
    }

    // Cannot unblock occupied slots
    if (slot.status === 'occupied') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SLOT_OCCUPIED',
          message: 'Cannot unblock an occupied slot. Cancel the booking first.',
        },
      });
    }

    await Slot.findByIdAndDelete(slotId);

    res.status(200).json({
      success: true,
      message: 'Time slot unblocked successfully',
      data: {
        deletedSlot: {
          id: slot._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * HOST: Update a blocked slot (edit time, reason, notes)
 * Cannot edit occupied slots
 */
export const updateBlockedSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;
    const { startTime, endTime, blockReason, notes } = req.body;

    const slot = await Slot.findById(slotId).populate('charger', 'owner');
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: { code: 'SLOT_NOT_FOUND', message: 'Slot not found' },
      });
    }

    // Verify ownership
    if (slot.charger.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own this charger' },
      });
    }

    // Cannot edit occupied slots
    if (slot.status === 'occupied') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SLOT_OCCUPIED',
          message: 'Cannot edit an occupied slot',
        },
      });
    }

    // Update fields
    if (startTime) {
      const newStart = new Date(startTime);
      if (newStart >= slot.endTime) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIME', message: 'Start time must be before end time' },
        });
      }
      slot.startTime = newStart;
    }

    if (endTime) {
      const newEnd = new Date(endTime);
      if (newEnd <= slot.startTime) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIME', message: 'End time must be after start time' },
        });
      }
      slot.endTime = newEnd;
    }

    if (blockReason !== undefined) slot.blockReason = blockReason;
    if (notes !== undefined) slot.notes = notes;

    await slot.save(); // Will trigger overlap validation

    res.status(200).json({
      success: true,
      data: {
        slot,
        message: 'Blocked slot updated successfully',
      },
    });
  } catch (error) {
    if (error.code === 'SLOT_OVERLAP_DETECTED') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLOT_OVERLAP',
          message: 'Updated time range would overlap with another slot',
        },
      });
    }
    next(error);
  }
};

/**
 * HOST: Create multiple available slots (bulk generation)
 * Useful for setting up weekly schedules
 */
export const generateAvailableSlots = async (req, res, next) => {
  try {
    const { chargerId } = req.params;
    const { startDate, endDate, slotDuration, dailyStartHour, dailyEndHour, excludedDays } = req.body;

    const charger = await Charger.findById(chargerId);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'CHARGER_NOT_FOUND', message: 'Charger not found' },
      });
    }

    if (charger.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own this charger' },
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = slotDuration || 2; // Default 2-hour slots
    const dayStart = dailyStartHour || 6; // Default 6 AM
    const dayEnd = dailyEndHour || 22; // Default 10 PM
    const excluded = excludedDays || []; // e.g., [0, 6] for Sunday, Saturday

    const slotsToCreate = [];
    const currentDate = new Date(start);

    while (currentDate < end) {
      const dayOfWeek = currentDate.getDay();

      // Skip excluded days
      if (!excluded.includes(dayOfWeek)) {
        // Generate slots for this day
        for (let hour = dayStart; hour < dayEnd; hour += duration) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setHours(hour + duration, 0, 0, 0);

          // Don't create past slots
          if (slotStart > new Date()) {
            // Check if slot already exists
            const existing = await Slot.findOne({
              charger: chargerId,
              startTime: slotStart,
              endTime: slotEnd,
            });

            if (!existing) {
              slotsToCreate.push({
                charger: chargerId,
                startTime: slotStart,
                endTime: slotEnd,
                price: charger.pricePerHour || 25,
                status: 'available',
              });
            }
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Bulk insert
    if (slotsToCreate.length > 0) {
      await Slot.insertMany(slotsToCreate);
    }

    res.status(201).json({
      success: true,
      data: {
        message: `Generated ${slotsToCreate.length} available slots`,
        count: slotsToCreate.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get slot grid for charger (used by frontend detail pages)
 * Public endpoint - shows available slots for booking
 */
export const getSlotGrid = async (req, res, next) => {
  try {
    const chargerId = req.params.id || req.params.chargerId;
    const { startDate, endDate, days = 7 } = req.query;

    const charger = await Charger.findById(chargerId);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'CHARGER_NOT_FOUND', message: 'Charger not found' },
      });
    }

    // Calculate date range
    const start = startDate ? new Date(startDate) : new Date();
    const daysNum = parseInt(days) || 7;
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + daysNum * 24 * 60 * 60 * 1000);

    // Get all slots for this specific charger in the date range
    const slots = await Slot.find({
      charger: chargerId,
      startTime: { $lt: end },
      endTime: { $gt: start },
    })
      .sort({ startTime: 1 })
      .lean();

    // Transform slots for frontend (hide blocked, show as occupied)
    const gridSlots = slots.map((slot) => ({
      _id: slot._id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status === 'blocked' ? 'occupied' : slot.status,
      price: slot.price || charger.pricePerHour,
      isBookable: slot.status === 'available',
      duration: (new Date(slot.endTime) - new Date(slot.startTime)) / (1000 * 60 * 60), // hours
    }));

    res.status(200).json({
      success: true,
      data: {
        charger: {
          _id: charger._id,
          title: charger.title,
          pricePerHour: charger.pricePerHour,
          location: charger.location,
        },
        dateRange: { start, end },
        slots: gridSlots,
      },
    });
  } catch (error) {
    next(error);
  }
};
