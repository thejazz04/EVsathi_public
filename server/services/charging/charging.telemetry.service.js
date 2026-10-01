import ChargingSession from '../../models/ChargingSession.js';
import Booking from '../../models/Booking.js';
import Charger from '../../models/Charger.js';
import logger from '../../utils/logger.js';

const chargingMode = process.env.CHARGING_MODE || 'simulation';

/**
 * Telemetry Simulation Provider Interface
 * Simulates energy consumption ($kWh = \text{PowerOutput} \times \text{Hours}$)
 * Cleanly replaceable by future OCPP/IoT physical charger telemetry provider.
 */
export const startChargingTelemetrySession = async ({ driverId, chargerId, bookingId }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }

  const charger = await Charger.findById(chargerId);
  if (!charger) {
    throw new Error('Charger not found');
  }

  const session = await ChargingSession.create({
    driver: driverId,
    charger: chargerId,
    booking: bookingId,
    startTime: new Date(),
    status: 'CHARGING',
    pricePerKwh: charger.pricePerKwh || 15,
    telemetryMode: chargingMode === 'simulation' ? 'SIMULATION' : 'PHYSICAL_OCPP',
  });

  booking.status = 'ACTIVE';
  await booking.save();

  logger.info(`Charging Session ${session._id} started in telemetry mode: ${session.telemetryMode}`);
  return session;
};

export const stopChargingTelemetrySession = async (sessionId) => {
  const session = await ChargingSession.findById(sessionId).populate('charger');
  if (!session) {
    throw new Error('Charging session not found');
  }

  const endTime = new Date();
  const durationHours = Math.max(0.1, (endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60));

  // Simulation calculation: Energy (kWh) = Power (kW) * Hours
  const powerKw = session.charger?.powerOutput || 7.4;
  const energyConsumedKwh = Number((powerKw * durationHours * 0.9).toFixed(2)); // 90% efficiency
  const totalCost = Math.round(energyConsumedKwh * session.pricePerKwh);

  session.endTime = endTime;
  session.energyConsumedKwh = energyConsumedKwh;
  session.totalCost = totalCost;
  session.status = 'COMPLETED';
  await session.save();

  await Booking.findByIdAndUpdate(session.booking, { status: 'COMPLETED' });

  logger.info(`Charging Session ${session._id} stopped. Consumed ${energyConsumedKwh} kWh`);
  return session;
};
