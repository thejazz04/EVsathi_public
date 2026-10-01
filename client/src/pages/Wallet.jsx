import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, Plus, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

const Wallet = () => {
  const { user, updateUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);

      const [balanceRes, transactionsRes] = await Promise.all([
        api.get('/payments/wallet/balance'),
        api.get('/payments/wallet/transactions'),
      ]);

      if (balanceRes.data?.success) {
        const newBalance = balanceRes.data.data.balance;
        setBalance(newBalance);
        
        // Sync with user context
        if (user) {
          updateUser({ ...user, walletBalance: newBalance });
        }
      }

      if (transactionsRes.data?.success) {
        setTransactions(transactionsRes.data.data.payments || []);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      if (error.response?.status === 401) {
        alert('Session expired. Please login again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setDepositing(true);
    try {
      const res = await api.post('/payments/wallet/deposit', {
        amount: Number(depositAmount),
      });

      if (res.data?.success) {
        const newBalance = res.data.data.newBalance;
        setBalance(newBalance);
        
        // Update user context with new balance
        if (user) {
          updateUser({ ...user, walletBalance: newBalance });
        }
        
        setDepositAmount('');
        setShowDepositModal(false);
        alert(`₹${depositAmount} deposited successfully!`);
        fetchWalletData(); // Refresh data
      } else {
        alert(res.data?.error?.message || 'Deposit failed');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        alert('Session expired. Please login again.');
      } else {
        alert(error.response?.data?.error?.message || 'Deposit failed. Please try again.');
      }
    } finally {
      setDepositing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading wallet...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <WalletIcon className="w-8 h-8 text-primary-600" />
          My Wallet
        </h1>
        <button
          onClick={() => fetchWalletData()}
          className="btn btn-outline flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Balance Card */}
      <div className="card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white mb-8 p-8">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-emerald-100 text-sm mb-2">Available Balance</p>
            <p className="text-5xl font-extrabold mb-4">₹{balance.toFixed(2)}</p>
            <button
              onClick={() => setShowDepositModal(true)}
              className="bg-white text-emerald-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-50 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Money
            </button>
          </div>
          <WalletIcon className="w-16 h-16 opacity-30" />
        </div>
      </div>

      {/* Transaction History */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
        
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No transactions yet</p>
            <p className="text-sm mt-2">Your payment history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((payment) => {
              // Use the explicit type field from Payment model
              const isCredit = payment.type === 'CREDIT' || payment.type === 'REFUND';
              const isDebit = payment.type === 'DEBIT';
              const date = new Date(payment.createdAt);

              return (
                <div
                  key={payment._id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      isCredit ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {isCredit ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {payment.description || (payment.booking ? 'Booking Payment' : 'Wallet Transaction')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {payment.razorpayPaymentId || 'N/A'} • {payment.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      isCredit ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isCredit ? '+' : '-'}₹{Math.abs(payment.amount)}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      payment.status === 'VERIFIED'
                        ? 'bg-green-100 text-green-700'
                        : payment.status === 'FAILED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-2xl font-bold mb-4">Add Money to Wallet</h3>
            <p className="text-sm text-gray-600 mb-6">
              Simulated UPI payment - Instant credit to wallet
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Enter Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount"
                className="input w-full text-lg"
                autoFocus
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {[100, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(String(amt))}
                  className="btn btn-outline py-2 text-sm"
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositAmount('');
                }}
                className="btn btn-outline flex-1"
                disabled={depositing}
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                className="btn btn-primary flex-1"
                disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
              >
                {depositing ? 'Processing...' : `Add ₹${depositAmount || '0'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
