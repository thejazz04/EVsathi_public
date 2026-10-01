import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Mail, Lock, Eye, EyeOff, Zap, Car, Building2 } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Card from '../components/ui/Card.jsx';

/**
 * Determine the appropriate dashboard path based on the normalized user role.
 * Preserves existing role normalization:
 * - driver / renter / DRIVER -> /driver/dashboard
 * - owner / host / HOST -> /owner/dashboard
 * - both -> /owner/dashboard (dual-role flow)
 * - admin -> /owner/dashboard
 */
export const getDashboardForRole = (role) => {
  const r = (role || '').trim().toLowerCase();
  if (['owner', 'host', 'both', 'admin'].includes(r)) {
    return '/owner/dashboard';
  }
  return '/driver/dashboard';
};

const Login = () => {
  const [roleSelection, setRoleSelection] = useState('driver'); // 'driver', 'host'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated, redirect to appropriate dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      const target = roleSelection === 'host' ? '/owner/dashboard' : getDashboardForRole(user.role);
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelect = (role) => {
    setRoleSelection(role);
    setError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login({ ...formData, role: roleSelection });
      const userObj = res?.data?.user;
      const userRole = (userObj?.role || '').toLowerCase();
      
      // Selected role determines default dashboard destination
      const defaultRedirect = roleSelection === 'host' ? '/owner/dashboard' : '/driver/dashboard';
      const requestedRedirect =
        location.state?.redirectTo ||
        sessionStorage.getItem('redirectAfterLogin') ||
        defaultRedirect;

      sessionStorage.removeItem('redirectAfterLogin');

      // Prevent redirecting back to any login route
      const safeRedirect = requestedRedirect.includes('/login') ? defaultRedirect : requestedRedirect;
      navigate(safeRedirect, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Unable to sign in. Please check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-evsathi-light">
      <div className="max-w-md w-full space-y-6">
        
        {/* EVsathi Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-evsathi-teal text-white flex items-center justify-center mx-auto shadow-md shadow-evsathi-teal/20">
            <Zap className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-evsathi-dark tracking-tight">
            EVsathi
          </h1>
          <p className="text-xs text-evsathi-slate max-w-xs mx-auto">
            Peer-to-Peer EV Charging Network
          </p>
        </div>

        {/* Role Selection: Driver, Host */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">
            Login As
          </label>
          <div className="bg-white p-1 rounded-2xl border border-evsathi-mint/60 shadow-xs grid grid-cols-2 text-xs font-extrabold gap-1">
            <button
              type="button"
              onClick={() => handleRoleSelect('driver')}
              className={`py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                roleSelection === 'driver'
                  ? 'bg-evsathi-teal text-white shadow-sm'
                  : 'text-evsathi-slate hover:text-evsathi-dark hover:bg-evsathi-light'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Driver</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('host')}
              className={`py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                roleSelection === 'host'
                  ? 'bg-evsathi-dark text-white shadow-sm'
                  : 'text-evsathi-slate hover:text-evsathi-dark hover:bg-evsathi-light'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Host</span>
            </button>
          </div>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl border-evsathi-mint/40 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold">
                {error}
              </div>
            )}

            <Input
              label="Email"
              id="email"
              name="email"
              type="email"
              required
              placeholder="Enter your email"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
            />

            <div className="relative">
              <Input
                label="Password"
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your password"
                icon={Lock}
                value={formData.password}
                onChange={handleChange}
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

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full py-3 text-sm shadow-md"
            >
              Login
            </Button>
          </form>

          {/* Forgot Password Link */}
          <div className="text-center pt-2">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-evsathi-teal hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
        </Card>

        {/* Register Link */}
        <div className="text-center">
          <p className="text-xs text-evsathi-slate">
            Don't have an account?{' '}
            <Link to="/register" className="font-extrabold text-evsathi-teal hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
