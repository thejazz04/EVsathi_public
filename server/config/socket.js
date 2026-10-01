import { Server as SocketIOServer } from 'socket.io';
import logger from '../utils/logger.js';
import { calculateDistanceKm } from '../utils/geo.js';

let io = null;
const userSockets = new Map(); // userId -> socketId
const lastLocations = new Map(); // userId -> { lat, lng, timestamp }

export const initSocket = (httpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Register User Room
    socket.on('register:user', (userId) => {
      if (userId) {
        userSockets.set(String(userId), socket.id);
        socket.join(`user_${userId}`);
        logger.debug(`User ${userId} joined room user_${userId}`);
      }
    });

    // Join Specific Rooms (Booking, Charger, Chat)
    socket.on('join:room', (roomName) => {
      if (roomName) {
        socket.join(roomName);
        logger.debug(`Socket ${socket.id} joined room ${roomName}`);
      }
    });

    socket.on('leave:room', (roomName) => {
      if (roomName) {
        socket.leave(roomName);
        logger.debug(`Socket ${socket.id} left room ${roomName}`);
      }
    });

    // Live Navigation & Location Updates with GPS Debouncing Threshold
    socket.on('navigation:location', (data) => {
      const { userId, lat, lng, routeId } = data || {};
      if (!userId || lat == null || lng == null) return;

      const prevLoc = lastLocations.get(String(userId));
      const now = Date.now();

      // Debouncing threshold: Only evaluate rerouting if distance > 100 meters (0.1 km) or > 10s elapsed
      if (prevLoc) {
        const distMovedKm = calculateDistanceKm(prevLoc.lat, prevLoc.lng, lat, lng);
        const timeElapsedSec = (now - prevLoc.timestamp) / 1000;

        if (distMovedKm < 0.1 && timeElapsedSec < 10) {
          // Minor GPS jitter, skip redundant processing
          return;
        }
      }

      lastLocations.set(String(userId), { lat, lng, timestamp: now });

      // Broadcast location update to active route/booking rooms
      if (routeId) {
        io.to(`route_${routeId}`).emit('navigation:update', { userId, lat, lng, timestamp: now });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      for (const [uId, sId] of userSockets.entries()) {
        if (sId === socket.id) {
          userSockets.delete(uId);
          lastLocations.delete(uId);
          break;
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const emitToUser = (userId, event, payload) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, payload);
  }
};

export const emitToRoom = (roomName, event, payload) => {
  if (io) {
    io.to(roomName).emit(event, payload);
  }
};
