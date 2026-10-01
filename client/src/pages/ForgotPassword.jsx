import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService.js';
import { Zap, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Card from '../components/ui/Card.jsx';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Unable to process password reset. Please try again.'
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
            Forgot Password
          </h1>
          <p className="text-xs text-evsathi-slate max-w-xs mx-auto">
            {submitted
              ? 'Check your email for instructions to reset your password.'
              : 'Enter your registered email address and we will send you a reset link.'}
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl border-evsathi-mint/40 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold">
              {error}
            </div>
          )}

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Registered Email Address"
                id="email"
                name="email"
                type="email"
                required
                placeholder="Enter your registered email"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full py-3 text-sm shadow-md"
                icon={ArrowRight}
                iconPosition="right"
              >
                Send Reset Link
              </Button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">Check Your Email</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If an account exists with that email address, a password reset link has been dispatched.
                  Please check your inbox and spam folder.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Link to="/login">
                  <Button variant="primary" className="w-full py-2.5 text-xs">
                    Return to Login
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Didn't receive email? Try another address
                </button>
              </div>
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

export default ForgotPassword;
