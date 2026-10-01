import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Car, Building2, ArrowRight, User, Mail, Phone, Lock, Eye, EyeOff, Zap } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Card from '../components/ui/Card.jsx';

const Register = () => {
  const [roleSelection, setRoleSelection] = useState('driver'); // 'driver', 'host'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

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

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long and contain letters and numbers.');
      return;
    }

    setLoading(true);

    try {
      await register({ ...formData, role: roleSelection });
      if (roleSelection === 'host') {
        navigate('/owner/dashboard', { replace: true });
      } else {
        navigate('/driver/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errorData = err.response?.data?.error;
      if (errorData?.details && Array.isArray(errorData.details)) {
        const details = errorData.details.map((d) => d.message || d).join(', ');
        setError(`${errorData.message || 'Validation failed'}: ${details}`);
      } else {
        setError(
          errorData?.message ||
          err.response?.data?.message ||
          'Registration failed. Please check your details and try again.'
        );
      }
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
            Create EVsathi Account
          </h1>
          <p className="text-xs text-evsathi-slate max-w-xs mx-auto">
            Join the peer-to-peer EV charging platform.
          </p>
        </div>

        {/* Role Selection: Driver, Host */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">
            Select Your Role
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

        <Card className="p-6 sm:p-8 shadow-xl border-evsathi-mint/40">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold">
                {error}
              </div>
            )}

            <Input
              label="Full Name"
              id="name"
              name="name"
              type="text"
              required
              placeholder="Your full name"
              icon={User}
              value={formData.name}
              onChange={handleChange}
            />

            <Input
              label="Email Address"
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
            />

            <Input
              label="Phone Number"
              id="phone"
              name="phone"
              type="tel"
              placeholder="10 digit mobile number"
              icon={Phone}
              maxLength={10}
              value={formData.phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, phone: val });
              }}
            />

            <div className="relative">
              <Input
                label="Password"
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Min. 8 characters"
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

            <p className="text-[11px] text-slate-400">
              Must include at least 8 characters with uppercase, lowercase, and numbers.
            </p>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full py-3 mt-4 text-sm shadow-md"
              icon={ArrowRight}
              iconPosition="right"
            >
              Register as {roleSelection === 'host' ? 'Host' : 'Driver'}
            </Button>
          </form>
        </Card>

        <div className="text-center">
          <p className="text-xs text-evsathi-slate">
            Already have an account?{' '}
            <Link to="/login" className="font-extrabold text-evsathi-teal hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
