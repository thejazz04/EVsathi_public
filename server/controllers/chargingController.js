import ChargingSession from '../models/ChargingSession.js';
import { startChargingTelemetrySession, stopChargingTelemetrySession } from '../services/charging/charging.telemetry.service.js';

export const startSession = async (req, res, next) => {
  try {
    const { chargerId, bookingId } = req.body;

    const session = await startChargingTelemetrySession({
      driverId: req.user._id,
      chargerId,
      bookingId,
    });

    res.status(201).json({
      success: true,
      data: { session },
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveSession = async (req, res, next) => {
  try {
    const session = await ChargingSession.findOne({
      driver: req.user._id,
      status: { $in: ['STARTED', 'CHARGING'] },
    })
      .populate('charger')
      .populate('booking');

    res.status(200).json({
      success: true,
      data: { session: session || null },
    });
  } catch (error) {
    next(error);
  }
};

export const stopSession = async (req, res, next) => {
  try {
    const session = await stopChargingTelemetrySession(req.params.id);

    res.status(200).json({
      success: true,
      data: { session },
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionHistory = async (req, res, next) => {
  try {
    const sessions = await ChargingSession.find({ driver: req.user._id })
      .populate('charger')
      .sort({ startTime: -1 });

    res.status(200).json({
      success: true,
      data: { sessions },
    });
  } catch (error) {
    next(error);
  }
};
