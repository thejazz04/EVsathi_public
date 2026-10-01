import api from './api.js';

export const paymentService = {
  depositToWallet: (amount) => api.post('/payments/wallet/deposit', { amount }),
  payWithWallet: (bookingId) => api.post('/payments/wallet/pay', { bookingId }),
  getWalletBalance: () => api.get('/payments/wallet/balance'),
  getWalletTransactions: () => api.get('/payments/wallet/transactions'),
};

export default paymentService;
