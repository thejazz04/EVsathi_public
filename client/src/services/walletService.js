import api from './api.js';

export const walletService = {
  async getTransactions() {
    return api.get('/wallet/transactions');
  },

  async topup(amount) {
    return api.post('/wallet/topup', { amount });
  },
};
