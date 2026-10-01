import Charger from '../models/Charger.js';
import Booking from '../models/Booking.js';
import { findNearbyChargers, calculateSmartScore } from '../services/charger/charger.service.js';
import { toGeoJSONPoint } from '../utils/geo.js';

export const getAllChargers = async (req, res, next) => {
  try {
    const {
      search,
      connectorType,
      chargerType,
      minPower,
      maxPrice,
      latitude,
      longitude,
      radius = 25,
      page = 1,
      limit = 20,
    } = req.query;

    if (latitude && longitude) {
      const nearby = await findNearbyChargers({
        latitude,
        longitude,
        radiusKm: Number(radius),
        filters: { connectorType, chargerType, minPower, maxPrice },
      });
      return res.status(200).json({
        success: true,
        data: {
          chargers: nearby,
          total: nearby.length,
          page: 1,
          pages: 1,
        },
      });
    }

    const query = {
      isActive: true,
      title: { $nin: ['CHG-PHASE10-001', 'CHG-PHASE11-001', 'CHG-PHASE12-001', 'CHG-NCR-001'] },
    };

    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { 'location.city': new RegExp(search, 'i') },
        { 'location.address': new RegExp(search, 'i') },
      ];
    }

    if (connectorType) query.connectorType = new RegExp(connectorType, 'i');
    if (chargerType) query.chargerType = new RegExp(chargerType, 'i');
    if (minPower) query.powerOutput = { $gte: Number(minPower) };
    if (maxPrice) query.pricePerHour = { $lte: Number(maxPrice) };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Charger.countDocuments(query);
    const chargers = await Charger.find(query)
      .populate('owner', 'name email phone avatar')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const formatted = chargers.map((c) => {
      const obj = c.toObject();
      obj.smartScore = calculateSmartScore({
        pricePerHour: obj.pricePerHour,
        powerOutputKw: obj.powerOutput,
        rating: obj.rating,
        isAvailable: obj.isAvailable,
      });
      return obj;
    });

    res.status(200).json({
      success: true,
      data: {
        chargers: formatted,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const searchChargers = async (req, res, next) => {
  return getAllChargers(req, res, next);
};

export const getChargerById = async (req, res, next) => {
  try {
    const charger = await Charger.findById(req.params.id).populate('owner', 'name email phone avatar');
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    const obj = charger.toObject();
    obj.smartScore = calculateSmartScore({
      pricePerHour: obj.pricePerHour,
      powerOutputKw: obj.powerOutput,
      rating: obj.rating,
      isAvailable: obj.isAvailable,
    });

    res.status(200).json({
      success: true,
      data: { charger: obj },
    });
  } catch (error) {
    next(error);
  }
};

export const createCharger = async (req, res, next) => {
  try {
    const { title, description, chargerType, connectorType, powerOutput, pricePerHour, pricePerKwh, location, amenities, images, availabilitySchedule } = req.body;

    const geoPoint = toGeoJSONPoint(location.coordinates.lat, location.coordinates.lng);

    const charger = await Charger.create({
      owner: req.user._id,
      title,
      description: description || '',
      chargerType: chargerType || 'Level 2',
      connectorType: connectorType || 'Type 2',
      powerOutput: Number(powerOutput),
      pricePerHour: Number(pricePerHour),
      pricePerKwh: pricePerKwh ? Number(pricePerKwh) : null,
      location: {
        address: location.address,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        country: location.country || 'India',
        type: 'Point',
        coordinates: geoPoint.coordinates,
      },
      amenities: amenities || [],
      images: images || [],
      availabilitySchedule: availabilitySchedule || [],
    });

    res.status(201).json({
      success: true,
      data: { charger },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCharger = async (req, res, next) => {
  try {
    const charger = await Charger.findById(req.params.id);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    if (String(charger.owner) !== String(req.user._id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to update this charger' },
      });
    }

    const updated = await Charger.findByIdAndUpdate(req.params.id, req.body, { new: true });

    res.status(200).json({
      success: true,
      data: { charger: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCharger = async (req, res, next) => {
  try {
    const charger = await Charger.findById(req.params.id);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    if (String(charger.owner) !== String(req.user._id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to delete this charger' },
      });
    }

    charger.isActive = false;
    await charger.save();

    res.status(200).json({
      success: true,
      message: 'Charger deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getMyChargers = async (req, res, next) => {
  try {
    const chargers = await Charger.find({ owner: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: { chargers },
    });
  } catch (error) {
    next(error);
  }
};

export const checkAvailability = async (req, res, next) => {
  try {
    const { startTime, endTime } = req.query;
    const charger = await Charger.findById(req.params.id);

    if (!charger || !charger.isAvailable || !charger.isActive) {
      return res.status(200).json({
        success: true,
        data: { isAvailable: false, reason: 'Charger disabled by host' },
      });
    }

    res.status(200).json({
      success: true,
      data: { isAvailable: true },
    });
  } catch (error) {
    next(error);
  }
};

export const disableCharger = async (req, res, next) => {
  try {
    const charger = await Charger.findById(req.params.id);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    charger.isAvailable = !charger.isAvailable;
    await charger.save();

    res.status(200).json({
      success: true,
      data: { charger },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get earnings for a specific charger
 * Supports range-based queries (today, 7days, 31days, custom)
 */
export const getChargerEarnings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { range = '7days', startDate, endDate } = req.query;

    const charger = await Charger.findById(id);
    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    // Authorization check
    if (String(charger.owner) !== String(req.user._id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to view earnings' },
      });
    }

    let queryStart, queryEnd;
    const now = new Date();

    // Determine date range
    if (startDate && endDate) {
      queryStart = new Date(startDate);
      queryEnd = new Date(endDate);
    } else if (range === 'today') {
      queryStart = new Date(now.setHours(0, 0, 0, 0));
      queryEnd = new Date(now.setHours(23, 59, 59, 999));
    } else if (range === '7days') {
      queryStart = new Date(now.setDate(now.getDate() - 6));
      queryStart.setHours(0, 0, 0, 0);
      queryEnd = new Date();
    } else if (range === '31days') {
      queryStart = new Date(now.setDate(now.getDate() - 30));
      queryStart.setHours(0, 0, 0, 0);
      queryEnd = new Date();
    }

    // Fetch completed/confirmed bookings
    const bookings = await Booking.find({
      charger: id,
      status: { $in: ['COMPLETED', 'CONFIRMED', 'ACTIVE', 'completed', 'confirmed', 'active'] },
      startTime: { $gte: queryStart, $lte: queryEnd },
    }).populate('driver', 'name email avatar').sort({ startTime: 1 });

    // Calculate total earnings
    const totalEarnings = bookings.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);

    // Daily breakdown
    const dailyEarnings = {};
    bookings.forEach((booking) => {
      const day = booking.startTime.toISOString().split('T')[0];
      if (!dailyEarnings[day]) {
        dailyEarnings[day] = { date: day, earnings: 0, bookings: 0 };
      }
      dailyEarnings[day].earnings += booking.totalPrice || 0;
      dailyEarnings[day].bookings += 1;
    });

    const dailyBreakdown = Object.values(dailyEarnings).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.status(200).json({
      success: true,
      data: {
        chargerId: id,
        chargerTitle: charger.title,
        range,
        startDate: queryStart,
        endDate: queryEnd,
        totalEarnings,
        totalBookings: bookings.length,
        dailyBreakdown,
        recentBookings: bookings.slice(-5).reverse(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get earnings summary for all host chargers
 */
export const getMyEarningsSummary = async (req, res, next) => {
  try {
    const chargers = await Charger.find({ owner: req.user._id, isActive: true });
    const chargerIds = chargers.map(c => c._id);

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 6));
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const thirtyOneDaysAgo = new Date(now.setDate(now.getDate() - 30));
    thirtyOneDaysAgo.setHours(0, 0, 0, 0);

    // Fetch bookings for all chargers
    const [todayBookings, sevenDayBookings, thirtyOneDayBookings] = await Promise.all([
      Booking.find({
        charger: { $in: chargerIds },
        status: { $in: ['COMPLETED', 'CONFIRMED', 'ACTIVE', 'completed', 'confirmed', 'active'] },
        startTime: { $gte: todayStart },
      }),
      Booking.find({
        charger: { $in: chargerIds },
        status: { $in: ['COMPLETED', 'CONFIRMED', 'ACTIVE', 'completed', 'confirmed', 'active'] },
        startTime: { $gte: sevenDaysAgo },
      }),
      Booking.find({
        charger: { $in: chargerIds },
        status: { $in: ['COMPLETED', 'CONFIRMED', 'ACTIVE', 'completed', 'confirmed', 'active'] },
        startTime: { $gte: thirtyOneDaysAgo },
      }),
    ]);

    const todayEarnings = todayBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const sevenDayEarnings = sevenDayBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const thirtyOneDayEarnings = thirtyOneDayBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Per-charger breakdown with recent bookings
    const chargerEarnings = await Promise.all(
      chargers.map(async (charger) => {
        const chargerBookings = sevenDayBookings.filter(
          (b) => String(b.charger) === String(charger._id)
        );
        
        // Get recent bookings with driver info
        const recentBookings = await Booking.find({
          charger: charger._id,
          status: { $in: ['COMPLETED', 'CONFIRMED', 'ACTIVE', 'completed', 'confirmed', 'active'] },
        })
          .populate('driver', 'name email avatar')
          .sort({ startTime: -1 })
          .limit(3);

        const earnings = chargerBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        return {
          chargerId: charger._id,
          title: charger.title,
          last7DaysEarnings: earnings,
          bookingCount: chargerBookings.length,
          recentBookings: recentBookings.map(b => ({
            _id: b._id,
            driverName: b.driver?.name || 'Unknown',
            driverAvatar: b.driver?.avatar,
            startTime: b.startTime,
            endTime: b.endTime,
            totalPrice: b.totalPrice,
            status: b.status,
          })),
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        todayEarnings,
        last7DaysEarnings: sevenDayEarnings,
        last31DaysEarnings: thirtyOneDayEarnings,
        chargers: chargerEarnings,
      },
    });
  } catch (error) {
    next(error);
  }
};
