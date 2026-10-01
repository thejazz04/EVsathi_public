import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { walletService } from '../services/walletService.js';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await walletService.getTransactions();
        if (!active) return;
        const list = res?.data?.data?.transactions || [];
        setTransactions(list);
      } catch (err) {
        if (!active) return;
        const message = err?.response?.data?.message || 'Unable to load transactions. Please try again.';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchTransactions();

    return () => {
      active = false;
    };
  }, []);

  const renderRow = (tx) => {
    const key = tx.id || tx._id;
    // Treat CREDIT as inflow and everything else (including refunds debiting a host) as outflow
    const isCredit = tx.type === 'CREDIT';
    const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
    const amountClass = isCredit ? 'text-green-600' : 'text-red-600';
    const iconBgClass = isCredit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600';
    const amountPrefix = isCredit ? '+' : '-';
    const formattedDate = new Date(tx.createdAt || tx.date).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return (
      <div key={key} className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${iconBgClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{tx.description}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="capitalize">{tx.category?.toLowerCase()}</span>
              <span>•</span>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
        <div className={`text-right font-semibold ${amountClass}`}>
          {amountPrefix}₹{Number(tx.amount || 0).toFixed(2)}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Transaction History</h1>
            <p className="text-gray-600">Track every debit, credit, and refund in your wallet.</p>
          </div>
          <Link to="/wallet" className="text-primary-600 hover:text-primary-700 font-medium">
            Back to Wallet
          </Link>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Recent activity</h2>
              <p className="text-sm text-gray-500">Latest wallet movements from your account.</p>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
            {loading && (
              <div className="py-6 text-center text-gray-500">Loading transactions...</div>
            )}

            {!loading && error && (
              <div className="py-6 text-center text-red-600">{error}</div>
            )}

            {!loading && !error && transactions.length === 0 && (
              <div className="py-6 text-center text-gray-500">No transactions yet.</div>
            )}

            {!loading && !error && transactions.map((tx) => renderRow(tx))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
