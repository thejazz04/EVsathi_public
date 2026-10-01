export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (API_BASE_URL.startsWith('http') ? API_BASE_URL.replace(/\/api(\/v1)?$/, '') : window.location.origin);

export const CHARGER_TYPES = ['Level 1', 'Level 2', 'DC Fast'];
export const CONNECTOR_TYPES = ['Type 1', 'Type 2', 'CCS', 'CHAdeMO', 'Tesla'];

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
};
