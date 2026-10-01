import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService.js';
import { Zap, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Card from '../components/ui/Card.jsx';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!token) {
      setError('This password reset link is invalid or has expired. Please request a new one.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        token: token.trim(),
        newPassword,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'This password reset link is invalid or has expired. Please request a new one.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-evsathi-light">
      <div className="max-w-md w-full space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-evsathi-teal text-white flex items-center justify-center mx-auto shadow-md shadow-evsathi-teal/20">
            <Zap className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-evsathi-dark tracking-tight">
            Reset Password
          </h1>
          <p className="text-xs text-evsathi-slate max-w-xs mx-auto">
            {success
              ? 'Your password has been changed successfully.'
              : 'Create a new secure password for your EVsathi account.'}
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl border-evsathi-mint/40 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!token && !success && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-600">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link to="/forgot-password">
                <Button variant="primary" className="w-full py-2.5 text-xs">
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          )}

          {token && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  label="New Password"
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min. 8 characters"
                  icon={Lock}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="Confirm New Password"
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat new password"
                  icon={Lock}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Password must be at least 8 characters long.
              </p>

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full py-3 text-sm shadow-md"
                icon={ArrowRight}
                iconPosition="right"
              >
                Reset Password
              </Button>
            </form>
          )}

          {success && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Password Changed Successfully</h3>
                <p className="text-xs text-slate-600">
                  Your password has been securely updated. Redirecting to login...
                </p>
              </div>
              <Link to="/login">
                <Button variant="primary" className="w-full py-3 text-sm mt-4">
                  Back to Login
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Footer Navigation */}
        <div className="text-center">
          <p className="text-xs text-evsathi-slate">
            Remember your password?{' '}
            <Link to="/login" className="font-extrabold text-evsathi-teal hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
